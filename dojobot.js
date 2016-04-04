/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/
*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var mongoose = require('mongoose');
var os = require('os');

var controller = Botkit.slackbot({
    debug: false,
});

mongoose.connect('mongodb://localhost/slackbot');
var UserSchema = new mongoose.Schema({
    user: String,
    github: String,
    refNum: Number,
    updated_at: {type: Date, default: Date.now}
});
mongoose.model('User', UserSchema);

//Build mongo objects

var bot = controller.spawn({
    token: process.env.token
}).startRTM();


controller.hears(['!reg (.*)', '.reg (.*)', '!register (.*)', '.register (.*)'], 'direct_message,ambient', function(bot, message) {
    //Get usernick
    var usernick = "";
    for (i in bot.users) {
        if (i['id'] == message.user){
            usernick = i['name'];
        }
    }

    //******************************************************
    //Need to add webcrawl checks to make sure this is valid
    //******************************************************
    var newGithub = message.match[1];

    var User = mongoose.model("User");
    User.findOne({user: message.user}, function(err, userData) {
        if(!userData) {
            //first get all users so reference numbers can be changed
            User.find({}, function(findAllErr, allUsers){
                if(!findAllErr){
                    //update each user's reference number
                    //shift all reference numbers over by one starting from whatever is referencing the 0 index currently
                    startIdx = 0;
                    for (var i in allUsers) {
                        if(allUsers[i].refNum == 0) {
                            startIdx = i;
                        }
                    }
                    for(var x = startIdx; x < allUsers.length; x++){
                        var newNum = allUsers[x].refNum - 1;
                        if (x == startIdx){
                            newNum = allUsers.length;
                        }
                        User.update({user: allUsers[x].user}, {refNum: newNum}, function(singleUpdateErr){
                            if(singleUpdateErr) {
                                console.log("Failed to update " + allUsers[x].user);
                                console.log(singleUpdateErr);
                            }
                        });
                    }
                }
            });

            //create and save new user now
            var user = new User({user: message.user, github: newGithub, refNum: 0});
            user.save(function(err) {
                if(err) {
                    console.log("User could not be saved!");
                    bot.reply(message, 'An error occured...Please try again later');
                } else {
                    console.log("New user added~");
                    bot.reply(message,'@' + usernick + ': Your GitHub account of ' + newGithub + ' has been saved.');
                }
            })
        } else {
            User.update({user:message.user}, {github: newGithub}, function(err){
                // This code will run when the DB has attempted to update the matching record.
                if(err){
                    bot.reply(message, 'An error occured...Please try again later');
                } else {
                    bot.reply(message,'@' + usernick + ': Your GitHub account of ' + newGithub + ' has been saved.');
                }
            });
        }
    });
});

controller.hears(['!gen', '.gen', '!generate', '.generate'], 'direct_message,ambient', function(bot, message) {
    //Get usernick
    var usernick = "";
    for (i in bot.users) {
        if (bot.users[i].id == message.user){
            usernick = bot.users[i].name;
        }
    }

    var User = mongoose.model('User');
    //first get all users so reference numbers can be changed

    User.find({}, function(findAllErr, allUsers){
        User.findOne({user: message.user}, function(err, userData) {
            if(userData && userData.github){
                bot.reply(message, '@' + usernick + ': Please use https://github.com/' + allUsers[userData.refNum].github + " for today~");
            } else {
                bot.reply(message, '@' + usernick + ': You currently do not have a Github account attached. Use the !reg feature to register');
            }
        });
    });
});

controller.hears(['.shuffle'], 'direct_message', function(bot, message){
    var User = mongoose.model('User');
    User.find({}, function(findAllErr, allUsers){
        if(findAllErr){
            console.log(findAllErr);
        } else {
            shift = 1;
            //check to see if you are about to move into your own index position, if so shift 2
            if(((allUsers[0].refNum + 1) % allUsers.length) == 0){
                shift = 2;
            }
            for (i in allUsers){
                var newNum = (allUsers[i].refNum + shift) % allUsers.length;
                User.update({user: allUsers[i].user}, {refNum: newNum}, function(updateErr){
                    if(updateErr) {
                        console.log("Failed to update " + allUsers[i].user);
                    }
                });
            }
            bot.reply(message, 'Shift attempted');
        }
    })
})



/*====================================================================================================
======================================================================================================
======================================================================================================
======================================================================================================*/

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {
    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
