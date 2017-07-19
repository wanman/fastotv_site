// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var ChannelSchema = require('./channel_scheme');
var DeviceSchema = require('./device');
var ChannelsTable = require('./channel');

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

userSchema.methods.getChannels = function (done) {
  var user_officials = this.official_channels;
  var user_private = this.private_channels;
  var user_private_pool = this.private_pool_channels;
  ChannelsTable.find({}, function (err, officials) {
    if (err) {
      return done(err);
    }

    var channels = []; // Create a new empty array.
    for (i = 0; i < user_officials.length; i++) {
      var channel = user_officials[i];
      for (j = 0; j < official.length; j++) {
        var offic = officials[j];
        if (channel._id === offic._id) {  // FIX ME find how to compare
          channels.push(offic);
          break;
        }
      }
    }

    for (i = 0; i < user_private.length; i++) {
      var channel = user_private[i];
      for (j = 0; j < user_private_pool.length; j++) {
        var priv = user_private_pool[j];
        if (channel._id === priv._id) {  // FIX ME find how to compare
          channels.push(priv);
          break;
        }
      }
    }
    return done(null, channels);
  });
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
