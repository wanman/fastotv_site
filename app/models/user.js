// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var channel_scheme = require('./channel_scheme');

// define the schema for our user model
var userSchema = mongoose.Schema({
    local            : {
        email        : String,
        password     : String
    },
    facebook         : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },
    
    name : String,
    created_date : Date,
    offical_channels : [{type: mongoose.Schema.Types.ObjectId, ref: 'Channel'}],
    private_channels : [ChannelSchema]
});

// generating a hash
userSchema.methods.generateHash = function(password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash;
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash === this.local.password;
};

// checking if password is valid
userSchema.methods.isReadOnlyMode = function() {
    return !this.local.email;
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);