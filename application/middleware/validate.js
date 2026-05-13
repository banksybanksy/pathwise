function asString(value) {
  return value == null ? '' : String(value).trim();
}

function requireFields(required, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const missing = required.filter((key) => asString(data[key]).length === 0);
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: missing.map((k) => `${k} is required`)
      });
    }
    next();
  };
}

function validateEnum(field, allowed, source = 'body') {
  return (req, res, next) => {
    const value = asString((req[source] || {})[field]).toLowerCase();
    if (value.length === 0) return next();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [`${field} must be one of: ${allowed.join(', ')}`]
      });
    }
    next();
  };
}

module.exports = { requireFields, validateEnum };
