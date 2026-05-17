import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// multer stores file temporarily in uploads/ folder
const upload = multer({ dest: 'uploads/' });

// POST /api/parse
// receives resume + jd from React
// forwards to FastAPI, returns result
router.post('/', upload.single('resume'), async (req, res) => {
    try {
        // check file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'No resume file uploaded' });
        }

        // check JD was provided
        const jd = req.body.jd;
        if (!jd) {
            return res.status(400).json({ error: 'No job description provided' });
        }

        // read the uploaded file from disk
        const fileBuffer = fs.readFileSync(req.file.path);
        const originalName = req.file.originalname;

        // build form data to send to FastAPI
        // FastAPI expects multipart/form-data with
        // 'resume' as file and 'jd' as text
        const form = new FormData();
        form.append('resume', fileBuffer, {
            filename: originalName,
            contentType: req.file.mimetype,
        });
        form.append('jd', jd);

        // call FastAPI NLP parser
        const fastApiResponse = await fetch('http://127.0.0.1:8000/parse', {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });

        // check FastAPI responded successfully
        if (!fastApiResponse.ok) {
            const errorText = await fastApiResponse.text();
            return res.status(500).json({
                error: 'FastAPI parser failed',
                details: errorText
            });
        }

        // get the parsed result
        const result = await fastApiResponse.json();

        // delete the temp file multer saved
        fs.unlinkSync(req.file.path);

        // send result back to React
        res.json(result);

    } catch (error) {
        // clean up temp file if error occurred
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Parse error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default router;