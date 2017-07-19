// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var ChannelSchema = require('./channel_scheme');
var DeviceSchema = require('./device');

// define the schema for our user model
var userSchema = mongoose.Schema({
  facebook: {
    id: String,
    token: String,
    email: String,
    name: String
  },
  twitter: {
    id: String,
    token: String,
    displayName: String,
    username: String
  },
  google: {
    id: String,
    token: String,
    email: String,
    name: String
  },

  name: String,
  email: String,
  password: String,
  created_date: Date,
  official_channels: [{type: mongoose.Schema.Types.ObjectId, ref: 'Channel'}],
  private_channels: [{type: mongoose.Schema.Types.ObjectId, ref: 'Channel'}],
  private_pool_channels: [ChannelSchema],
  type: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER'
  },
  devices: [DeviceSchema]
});

// generating a hash
userSchema.methods.generateHash = function (password) {
  var hash = crypto.createHash('md5').update(password).digest('hex');
  return hash;
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
  var hash = crypto.createHash('md5').update(password).digest('hex');
  return hash === this.password;
};

// checking if password is valid
userSchema.methods.isReadOnlyMode = function () {
  return !this.email;
};

// checking if password is valid
userSchema.methods.isAdministrator = function () {
  return this.type === 'ADMIN';
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
