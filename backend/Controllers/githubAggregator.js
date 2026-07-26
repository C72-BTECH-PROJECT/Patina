import fetch from 'node-fetch';

/**
 * Extracts username from a GitHub URL and fetches their repositories
 * to determine which languages/technologies they actually use.
 * 
 * @param {string} githubUrl 
 * @returns {Promise<string[]>} Array of unique languages used in their repos
 */
export const fetchGitHubLanguages = async (githubUrl) => {
    if (!githubUrl) return [];

    try {
        // Extract username from URL (e.g. https://github.com/username)
        const match = githubUrl.match(/github\.com\/([^/]+)/i);
        if (!match) return [];
        
        const username = match[1];

        // Fetch user's public repositories
        const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
        
        if (!response.ok) {
            console.warn(`GitHub API failed for user ${username}: ${response.status}`);
            return [];
        }

        const repos = await response.json();
        
        // Extract all languages used across repositories
        const languages = new Set();
        
        repos.forEach(repo => {
            if (repo.language) {
                languages.add(repo.language.toLowerCase());
            }
            // Some repos might have topics that indicate frameworks (e.g., react, nodejs)
            if (repo.topics && Array.isArray(repo.topics)) {
                repo.topics.forEach(topic => languages.add(topic.toLowerCase()));
            }
        });

        return Array.from(languages);

    } catch (error) {
        console.error("Error fetching GitHub data:", error);
        return [];
    }
};
