// Request-field checks shared by controllers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Must be a string: a JSON array holding one UUID stringifies to a valid UUID,
// and would otherwise pass the regex and reach the query (I-0029).
export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);
