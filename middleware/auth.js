const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // 1. Get token from header packet
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer TOKEN_STRING"

  // Check if token exists
  if (!token) {
    return res.status(401).json({ success: false, message: 'No security token found, authorization denied.' });
  }

  try {
    // 2. Verify encrypted token string using JWT Secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add verified user payload parameter directly into active request stream
    req.user = decoded;
    next(); // Move to the next controller route securely
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session token has expired or is invalid.' });
  }
};