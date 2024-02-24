const fs = require('fs');

const { Client, GatewayIntentBits, ActivityType } = require(`discord.js`);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const prefix = "k";

let channelID;


try {
    const channelIdData = fs.readFileSync('channelID.txt', 'utf8');
    channelID = channelIdData;
} catch (err) {
    console.log('No saved channelID found. Please set up one.');
}

// Leaderboard and questions management
let leaderboard = {}; // Format: { userId: points }
let currentQuestion = {
    question: "",
    answer: "",
    endTime: null,
    correctUsers: []  // This should be an array from the start
};

client.once("ready", () => {
    console.log("Bot is online");
    client.user.setActivity(`Question Of The Day`, { type: ActivityType.Competing });
});

client.on("messageCreate", (message) => {
    if (message.author.bot || message.channel.id !== channelID) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'setup' && message.member.permissions.has('ADMINISTRATOR')) { // Ensure only admins can run this
        if (args.length < 1) return message.reply('Please provide the channel ID.');
        channelID = args[0];
        fs.writeFileSync('channelID.txt', channelID); // Save the channel ID to a file
        return message.reply(`Bot has been setup to only operate in <#${channelID}>.`);
    }

    // Check if the message is in the designated channel
    if (message.channel.id !== channelID) return;

    // Handling `question` command
    if (command === "question") {
        const questionArgs = message.content.match(/"([^"]+)"/g); // This regex matches anything inside quotes
    
        // Check if the user included both a question and an answer inside quotes
        if (!questionArgs || questionArgs.length < 2) {
            return message.reply('Please format your question and answer like: /question "question" "answer"');
        }
    
        // Extract question and answer, removing quotes
        const question = questionArgs[0].replace(/"/g, '');
        const answer = questionArgs[1].replace(/"/g, '').trim().toLowerCase();
    
        currentQuestion = {
            question,
            answer,
            endTime: Date.now() + 86400000, // 24 hours from now
            correctUsers: []
        };
    
        return message.channel.send(`**New question:**\n${currentQuestion.question}`);
    }

    // Check for answer submissions
    if (currentQuestion.question && Date.now() <= currentQuestion.endTime) {
        if (message.content.trim().toLowerCase() === currentQuestion.answer) {
            const userId = message.author.id;
            // Check if the user has already answered correctly
            if (!currentQuestion.correctUsers.includes(userId)) {
                currentQuestion.correctUsers.push(userId); // Mark user as having answered correctly
                
                if (!leaderboard[userId]) leaderboard[userId] = 0;
                leaderboard[userId]++;
                
                message.reply("Correct answer! +1 point.");
            } else { message.reply("You've already answered this question correctly!"); }
        }
    }

    // Display leaderboard
    if (command === "leaderboard") {
        const sortedLeaderboard = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
        let leaderboardMessage = "Leaderboard:\n";
        sortedLeaderboard.forEach(([userId, points], index) => {
            leaderboardMessage += `${index + 1}. <@${userId}> with ${points} points\n`;
        });

        return message.channel.send(leaderboardMessage);
    }
});

// Timeout function to check if the question time has ended
const checkQuestionTimeout = () => {
    if (Date.now() > currentQuestion.endTime) {
        // Post the leaderboard
        const sortedLeaderboard = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
        let leaderboardMessage = "Time's up! Here's the final leaderboard:\n";
        sortedLeaderboard.forEach(([userId, points], index) => {
            leaderboardMessage += `${index + 1}. <@${userId}> with ${points} points\n`;
        });

        const designatedChannel = client.channels.cache.get(channelID);
        designatedChannel.send(leaderboardMessage);

        currentQuestion = { question: "", answer: "", endTime: null, correctUsers: [] };
    }

    // Check again in 1 minute
    setTimeout(checkQuestionTimeout, 60000);
};

client.login("");
