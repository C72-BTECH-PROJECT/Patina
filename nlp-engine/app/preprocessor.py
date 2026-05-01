import spacy

# load the english model once at module level
# loading it here means it loads only once when the app starts
# not every time the function is called — much faster
nlp = spacy.load("en_core_web_sm")

def preprocess(text: str) -> dict:
    # pass raw text through spacy pipeline
    doc = nlp(text)

    # tokenize + lemmatize + filter
    tokens = [
        token.lemma_.lower()        # lemmatize and lowercase
        for token in doc
        if not token.is_stop        # remove stopwords (the, a, is)
        and not token.is_punct      # remove punctuation (. , : etc)
        and not token.is_space      # remove whitespace tokens
        and token.is_alpha          # only real words, no numbers/symbols
        and len(token.text) > 1     # remove single letter tokens
    ]

    # extract sentences as list
    sentences = [sent.text.strip() for sent in doc.sents]

    # extract noun chunks — useful for skill phrases
    # noun chunks are meaningful phrases like "customer service"
    # "cash handling" "communication skills" rather than single words
    noun_chunks = [
        chunk.text.lower().strip()
        for chunk in doc.noun_chunks
        if len(chunk.text.strip()) > 2
    ]

    return {
        "tokens": tokens,
        "sentences": sentences,
        "noun_chunks": noun_chunks,
        "token_count": len(tokens)
    }

# ── TEST BLOCK ──────────────────────────────────────────
if __name__ == "__main__":
    # import extractor to get real resume text
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.extractor import extract_text

    # extract text from sample resume
    raw_text = extract_text("sample_resume.pdf")

    # preprocess it
    result = preprocess(raw_text)

    print("──── TOKENS (first 30) ────")
    print(result["tokens"][:30])

    print("\n──── NOUN CHUNKS (first 10) ────")
    print(result["noun_chunks"][:10])

    print("\n──── TOTAL TOKENS ────")
    print(result["token_count"])

    print("\n──── TOTAL SENTENCES ────")
    print(len(result["sentences"]))