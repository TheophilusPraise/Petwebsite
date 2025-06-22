export const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    console.log('Authenticated user:', req.session.user.email);
    return next();
  }
  console.log('No session, redirecting to login');
  res.redirect('/auth/login');
};

export const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).render('error', { message: 'Admin access required' });
};
