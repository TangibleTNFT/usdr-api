var createError = require('http-errors');
var express = require('express');
var cors = require('cors');
var logger = require('morgan');

var usdrRouter = require('./routes/usdr');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(cors());

app.use('/usdr', usdrRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404))
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.send(res.locals.error);
});

module.exports = app;
