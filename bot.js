const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, Collection, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const axios = require('axios')
const dictionary = require('./utils/dictionary')
const { setChannel } = require('./utils/channel')
const stats = require('./utils/stats')
require('dotenv').config()

const emptyData = {}
const dataPath = path.resolve(__dirname, './data/data.json')
const wordDataPath = path.resolve(__dirname, './data/word-data.json')
const queryPath = path.resolve(__dirname, './data/query.txt')
const wordPlayedPath = path.resolve(__dirname, './data/word-played.txt')
const roundPlayedPath = path.resolve(__dirname, './data/round-played.txt')
const wordDataUrl = 'https://github.com/undertheseanlp/dictionary/raw/master/dictionary/words.txt'
const wordDatabasePath = path.resolve(__dirname, './data/words.txt')
const rankingPath = path.resolve(__dirname, './data/ranking.json')
const contributeWordsUrl = 'https://github.com/lvdat/phobo-contribute-words/raw/main/accepted-words.txt'
const contributeWordsPath = path.resolve(__dirname, './data/contribute-words.txt')
const premiumGuildsPath = path.resolve(__dirname, './data/premium-guilds.txt')
const reportWordsPath = path.resolve(__dirname, './data/report-words.txt')
const officalWordsPath = path.resolve(__dirname, './data/official-words.txt')

// global config
const START_COMMAND = '!start'
const STOP_COMMAND = '!stop'
const PREFIX = '!FD'
const AutoDeleteMessageTime = 5 // Time to delete message after send
let queryCount = stats.getQuery()

// Voting data
let ongoingVote = {}
const SET_THRESHOLD_COMMAND = '!setvote' // Number of votes required to stop the game
const TimeComponentCollector = 3600 // Thời gian khảo sát

let data = {}

if (!fs.existsSync(dataPath)) {
    console.log(`[WARNING] File data.json doesn't exist. Creating...`)
    fs.writeFileSync(dataPath, JSON.stringify(emptyData))
    data = emptyData
} else {
    console.log(`[OK] File data.json exist.`)
    data = require(dataPath)
}

if (!fs.existsSync(wordDataPath)) {
    console.log(`[WARNING] File word-data.json doesn't exist. Creating...`)
    fs.writeFileSync(wordDataPath, JSON.stringify(emptyData))
} else {
    console.log(`[OK] File word-data.json exist.`)
}

if (!fs.existsSync(queryPath)) {
    console.log(`[WARNING] File query.txt doesn't exist. Creating...`)
    fs.writeFileSync(queryPath, '0')
} else {
    console.log(`[OK] File query.txt exist.`)
}

if (!fs.existsSync(rankingPath)) {
    console.log(`[WARNING] File ranking.json doesn't exist. Creating...`)
    fs.writeFileSync(rankingPath, JSON.stringify(emptyData))
} else {
    console.log(`[OK] File ranking.json exist.`)
}

if (!fs.existsSync(premiumGuildsPath)) {
    console.log(`[WARNING] File premium-guilds.txt doesn't exist. Creating...`)
    fs.writeFileSync(premiumGuildsPath, '')
} else {
    console.log(`[OK] File premium-guilds.txt exist.`)
}

if (!fs.existsSync(reportWordsPath)) {
    console.log(`[WARNING] File report-words.txt doesn't exist. Creating...`)
    fs.writeFileSync(reportWordsPath, '')
} else {
    console.log(`[OK] File report-words.txt exist.`)
}

if (!fs.existsSync(officalWordsPath)) {
    console.log(`[WARNING] File official-words.txt doesn't exist. Creating...`)
    fs.writeFileSync(officalWordsPath, '')
} else {
    console.log(`[OK] File official-words.txt exist.`)
}

if (!fs.existsSync(wordPlayedPath)) {
    console.log(`[WARNING] File word-played.txt doesn't exist. Creating...`)
    fs.writeFileSync(wordPlayedPath, '0')
} else {
    console.log(`[OK] File word-played.txt exist.`)
}

if (!fs.existsSync(roundPlayedPath)) {
    console.log(`[WARNING] File round-played.txt doesn't exist. Creating...`)
    fs.writeFileSync(roundPlayedPath, '0')
} else {
    console.log(`[OK] File round-played.txt exist.`)
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
})

let dicData = []

// load word data
if (!fs.existsSync(wordDatabasePath)) {
    console.log('[WARNING] Downloading words database from Github...')
    // load dictionary from Github repo
    axios.get(wordDataUrl)
        .then(async res => {
            const lines = res.data.trim().split('\n')
            const wordsdb = lines.map(line => JSON.parse(line).text)
            fs.writeFileSync(wordDatabasePath, wordsdb.join('\n'))
            console.log('[OK] Saved words database to ' + wordDatabasePath)

            await continueExecution()
        })
        .catch(err => {
            console.log('[ERROR] Error when download data: ' + err.message)
            return
        })
} else {
    continueExecution()
}

async function continueExecution() {
    console.log('[WARNING] Loading words...')
    fs.readFile(wordDatabasePath, 'utf-8', (err, data) => {
        if(err) {
            console.log('[ERROR] Error when load words:', err)
            return
        }
        const tempWord = data.toLowerCase().split('\n')
        console.log(`[OK] Loaded ${tempWord.length} words. Normalizing...`)
        global.dicData = tempWord.filter(w => w.split(' ').length == 2 && !w.includes('-') && !w.includes('(') && !w.includes(')'))
        console.log(`[OK] Normalized words. ${global.dicData.length} words remaining.`)
        // console.log(global.dicData)
    })
}

console.log('[WARNING] Downloading contribute words from Github...')
axios.get(contributeWordsUrl)
    .then(async res => {
        const lines = res.data.toLowerCase().trim().split('\n')
        fs.writeFileSync(contributeWordsPath, lines.join('\n'))
        console.log('[OK] Saved ' + lines.length + ' contribute words to ' + contributeWordsPath)
        global.dicData = global.dicData.concat(lines)
        console.log('[WARNING] Bot dictionary now have ' + global.dicData.length + ' words')
        fs.writeFileSync(officalWordsPath, global.dicData.join('\n'))
        console.log('[OK] Saved official words to official-words.txt')
    })
    .catch(err => {
        console.log('[ERROR] Error when download contribute words: ' + err.message)
        return
    })

// We create a collection for commands
client.commands = new Collection()
const commandFiles = fs
  .readdirSync('./commands')
  .filter((file) => file.endsWith('.js'))

for (const file of commandFiles) {
    const command = require(`./commands/${file}`)
    client.commands.set(command.data.name, command)
}

// Events like ready.js (when the robot turns on), 
// or messageCreate.js (when a user/robot sends a message)
const eventFiles = fs
  .readdirSync('./events')
  .filter((file) => file.endsWith('.js'))

for (const file of eventFiles) {
    const event = require(`./events/${file}`)
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client))
    } else {
        client.on(event.name, (...args) => event.execute(...args, client))
    }
}

// LOGIC GAME
client.on('messageCreate', async message => {
    const dataChannel = require(dataPath)
    const wordDataChannel = require(wordDataPath)
    const rankingData = require(rankingPath)
    const blackListWords = dictionary.getReportWords()

    global.dicData = global.dicData.filter(item => !blackListWords.includes(item))

    const checkDict = (word) => {
        return global.dicData.includes(word.toLowerCase())
    }

    // function
    const sendMessageToChannel = (msg, channel_id) => {
        client.channels.cache.get(channel_id).send({
            content: msg,
            flags: [4096]
        })
    }

    const sendAutoDeleteMessageToChannel = (msg, channel_id, seconds = AutoDeleteMessageTime) => {
        client.channels.cache.get(channel_id).send({
            content: msg,
            flags: [4096]
        }).then(mess => setTimeout(() => mess.delete(), 1000 * seconds))
    }
 
    const isWordDataExist = (channel) => {
        return wordDataChannel[channel] !== undefined
    }

    const isGameRunning = (channel) => {
        return isWordDataExist(channel) && wordDataChannel[channel].running === true
    }

    /**
     * 
     * @param {String} word 
     * @returns {Boolean}
     */
    const checkIfHaveAnswer = (word) => {
        let w = word.split(/ +/)
        let lc = w[w.length - 1]
        for (let i = 0; i < global.dicData.length; i++) {
            queryCount++
            let temp = global.dicData[i]
            let tempw = temp.split(/ +/)
            if (tempw.length > 1 && tempw[0] === lc && temp !== word) {
                // detect word
                return true
            }
        }
        return false
    }

    const randomWord = () => {
        const wordIndex = Math.floor(Math.random() * (global.dicData.length - 1))
        queryCount += wordIndex + 1
        const rWord = global.dicData[wordIndex]
        return checkIfHaveAnswer(rWord) ? rWord : randomWord()
    }

    const startGame = (channel) => {
        let rwords = []
        let word = randomWord()
        rwords.push(word)
        wordDataChannel[channel].running = true
        wordDataChannel[channel].words = rwords
        sendMessageToChannel(`Từ bắt đầu: **${word}**`, channel)
        fs.writeFileSync(wordDataPath, JSON.stringify(wordDataChannel))
    }
    const stopGame = (channel) => {
        wordDataChannel[channel].running = false
        fs.writeFileSync(wordDataPath, JSON.stringify(wordDataChannel))
    }

    const initWordData = (channel) => {
        wordDataChannel[channel] = {
            running: false,
            currentPlayer: {},
            words: []
        }
        fs.writeFileSync(wordDataPath, JSON.stringify(wordDataChannel))
    }

    const initRankingData = (guild) => {
        rankingData[guild] = {
            players: []
        }
        fs.writeFileSync(rankingPath, JSON.stringify(rankingData))
    }

    // end function

    if(message.author.bot) return // detect mess from BOT

    let guild = message.guild
    let channel = message.channel

    if(dataChannel[guild.id] === undefined || dataChannel[guild.id].channel === undefined) {
        // detect channel not config
        queryCount++
        return
    }
    let configChannel = dataChannel[guild.id].channel

    // FIRST LOAD
    if (message.content.startsWith(PREFIX)) {
        let arg = message.content.trim().split(/\s+/).filter(Boolean)[1]
        console.log(`[${message.guild.name}][${message.channel.name}] ${message.author.displayName} used prefix command [${arg ? arg : 'no action'}]`)
        if (arg === 'set') {
            if (!message.member.permissionsIn(configChannel).has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply({
                    content: 'Bạn cần có quyền `MANAGE_GUILD` để dùng lệnh này',
                    ephemeral: true
                })
            } else {
                setChannel(message.guildId, message.channelId)
                return message.reply({
                    content: `Bạn đã chọn kênh **${message.channel.name}** làm kênh nối từ của máy chủ **${message.guild.name}**. Dùng \`!start\` để bắt đầu trò chơi`,
                    ephemeral: true
                })
            }
        }
    }

    if (message.channel.id !== configChannel) return

    if(!isWordDataExist(configChannel)) {
        initWordData(configChannel)
    }

    if (rankingData[guild.id] === undefined) {
        // create ranking data for server if dont have.
        queryCount++
        initRankingData(guild.id)
    }

    let isRunning = isGameRunning(configChannel)

    if (message.content === START_COMMAND) {
        if (!isRunning) {
            sendMessageToChannel(`Trò chơi đã bắt đầu!`, configChannel)
            startGame(configChannel)
        } else sendMessageToChannel('Trò chơi vẫn đang tiếp tục. Bạn có thể dùng `!stop` để kết thúc lượt chơi này.', configChannel)
        return
    } else if (message.content === STOP_COMMAND) {

        if(!message.member.permissionsIn(configChannel).has(PermissionsBitField.Flags.ManageChannels)) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stop_confirm')
                        .setLabel(' Bí quá. Vote kết thúc lượt!!! ')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('stop_cancel')
                        .setLabel('Chậm đã. Hủy vote ngay và luôn.')
                        .setStyle(ButtonStyle.Secondary),
                );
    
            if (!ongoingVote[configChannel]) {
                ongoingVote[configChannel] = {
                    count: 0,
                    voters: []
                }
            }
    
            const pollMessage = await message.channel.send({
                content: `Bạn không có quyền dùng lệnh này. Hãy bỏ phiếu để dừng trò chơi.\nĐã có ${ongoingVote[configChannel].count} phiếu. Cần ${data[guild.id].voteThreshold - ongoingVote[configChannel].count} phiếu nữa để dừng.`,
                components: [row],
            });
    
            const filter = i => i.customId === 'stop_confirm' || i.customId === 'stop_cancel';
            const collector = pollMessage.createMessageComponentCollector({ filter, time: TimeComponentCollector * 1000 }); // Thời gian bỏ phiếu là x giây
    
            collector.on('collect', async i => {
                if (i.customId === 'stop_confirm') {
                    if (!ongoingVote[configChannel].voters.includes(i.user.id)) {
                        ongoingVote[configChannel].count++
                        ongoingVote[configChannel].voters.push(i.user.id)
                        if (ongoingVote[configChannel].count >= data[guild.id].voteThreshold) {
                            pollMessage.edit({ content: 'Đủ số phiếu chọn kết thúc lượt. Lượt mới đã bắt đầu!', components: [] });
                            initWordData(configChannel)
                            stats.addRoundPlayedCount()
                            startGame(configChannel)
                            delete ongoingVote[configChannel]
                            collector.stop(); // Kết thúc bỏ phiếu nếu đủ số phiếu
                        } else {
                            pollMessage.edit({ content: `Đã có ${ongoingVote[configChannel].count} phiếu. Cần ${data[guild.id].voteThreshold - ongoingVote[configChannel].count} phiếu nữa để dừng.`, components: [row] });
                            await i.reply({ content: 'Oke. Bạn đã bỏ phiếu dừng lượt nối từ này.', ephemeral: true });
                            setTimeout(() => i.deleteReply(), AutoDeleteMessageTime * 1000); // Đổi từ mili giây sang giây
                        }
                    } else {
                        await i.reply({ content: 'Chậm đã. Bạn đã bỏ phiếu rồi.', ephemeral: true });
                        setTimeout(() => i.deleteReply(), AutoDeleteMessageTime * 1000); // Đổi từ mili giây sang giây
                    }
                } else {
                    await i.update({ content: 'Đã hủy bỏ vote kết thúc lượt nối từ.', components: [] });
                    collector.stop();
                }
            });
    
            collector.on('end', collected => {
                if (!collected.size) {
                    sendAutoDeleteMessageToChannel('Thời gian bỏ phiếu đã hết. Tiếp tục nối từ nào.', configChannel);
                }
                delete ongoingVote[configChannel];
                setTimeout(() => pollMessage.delete(), AutoDeleteMessageTime * 1000); // Đổi từ mili giây sang giây
            });

            // Gán collector vào ongoingVote để sử dụng sau này
            ongoingVote[configChannel].collector = collector;

            return
        }
    
        if (isRunning) {
            sendMessageToChannel(`Đã kết thúc lượt này! Lượt mới đã bắt đầu!`, configChannel)
            initWordData(configChannel)
            stats.addRoundPlayedCount()
            startGame(configChannel)
        } else sendMessageToChannel('Trò chơi chưa bắt đầu. Bạn có thể dùng `!start`', configChannel)
        return
    } else if (message.content.startsWith(SET_THRESHOLD_COMMAND)) {
        if (!message.member.permissionsIn(configChannel).has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply({
                content: 'Bạn không có quyền để dùng lệnh này',
                ephemeral: true
            });
        }
        const args = message.content.split(' ')
        if (args.length === 2 && !isNaN(args[1])) {
            const newThreshold = parseInt(args[1], 10)
            if (!data[guild.id]) {
                data[guild.id] = {}
            }
            data[guild.id].voteThreshold = newThreshold
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
            message.reply({
                content: `Số lượng phiếu mới để dừng trò chơi là ${newThreshold}`,
                ephemeral: true
            });
        } else {
            message.reply({
                content: 'Sử dụng lệnh đúng định dạng: !setvote <số lượng>',
                ephemeral: true
            });
        }
        return
    }

    if (!isRunning) {
        // check if game is running
        sendMessageToChannel('Trò chơi chưa bắt đầu. Bạn có thể dùng `!start`', configChannel)
        return
    }

    let currentWordData = wordDataChannel[configChannel]
    let tu = message.content.trim().toLowerCase()
    let args1 = tu.split(/\s+/).filter(Boolean) // split fix for multiple space in word.
    tu = args1.join(' ') // remake word after split.
    let words = wordDataChannel[configChannel].words

    // functions load after channel defined
    /**
     * 
     * @param {String} word 
     * @returns {Boolean}
     */
    const checkIfWordUsed = (word) => {
        for (let j = 0; j < words.length; j++) {
            queryCount++
            if (words[j] === word) {
                return true
            }
        }
    }

    /**
     * 
     * @param {String} word 
     * @returns {Boolean}
     */
    const checkIfHaveAnswerInDb = (word) => {
        let w = word.split(/ +/)
        let lc = w[w.length - 1]
        for (let i = 0; i < global.dicData.length; i++) {
            queryCount++
            let temp = global.dicData[i]
            let tempw = temp.split(/ +/)
            if (tempw.length > 1 && tempw[0] === lc && temp !== word) {
                // detect word
                if (checkIfWordUsed(temp)) {
                    // if word is used, cancel this loop round.
                    continue
                }
                return true
            }
        }
        return false
    }
    /**
     * 
     * @param {Number} userId 
     * @returns {Boolean}
     */
    const checkUserRankingDataExist = (userId) => {
        let playerArray = rankingData[message.guildId].players
        if (playerArray.length === 0) return false
        for (let i = 0; i < playerArray.length; i++) {
            queryCount++
            if (playerArray[i].id === userId) {
                return true
            }
        }
        return false
    }

    /**
     * 
     * @param {Number} userId 
     * @param {String} name 
     * @param {String|Url} avatar
     */
    const initRankDataForUser = (userId, name, avatar) => {
        rankingData[message.guildId].players.push({
            id: userId,
            win: 0,
            total: 0,
            true: 0,
            name,
            avatar
        })
        fs.writeFileSync(rankingPath, JSON.stringify(rankingData))
    }

    /**
     * 
     * @param {Number} userId 
     * @param {String} newName 
     * @param {String} newAvatar 
     */
    const updateInfoUserRankData = (userId, newName, newAvatar) => {
        for (let i = 0; i < rankingData[message.guildId].players.length; i++) {
            queryCount++
            if(rankingData[message.guildId].players[i].id === userId) {
                rankingData[message.guildId].players[i].name = newName
                rankingData[message.guildId].players[i].avatar = newAvatar
            }
        }
        fs.writeFileSync(rankingPath, JSON.stringify(rankingData))
    }

    /**
     * 
     * @param {Number} newWin
     * @param {Number} newTrue
     * @param {Number} newTotal 
     */
    const updateRankingForUser = (newWin, newTrue, newTotal) => {
        for (let i = 0; i < rankingData[message.guildId].players.length; i++) {
            queryCount++
            if(rankingData[message.guildId].players[i].id === message.author.id) {
                rankingData[message.guildId].players[i].win += newWin
                rankingData[message.guildId].players[i].true += newTrue
                rankingData[message.guildId].players[i].total += newTotal
            }
        }
        fs.writeFileSync(rankingPath, JSON.stringify(rankingData))
    }

    // end function

    if (!checkUserRankingDataExist(message.author.id)) {
        initRankDataForUser(message.author.id, message.author.displayName, message.author.avatarURL())
    } else {
        updateInfoUserRankData(message.author.id, message.author.displayName, message.author.avatarURL())
    }

    // console.log(rankingData)

    // check if words have or more than 1 space
    if (!(args1.length == 2)) {
        // message.react('❌')
        // sendAutoDeleteMessageToChannel('Vui lòng nhập từ có chứa nhiều hơn 2 từ!', configChannel)
        return
    }

    if(words.length > 0) {
        // player can't answer 2 times
        let lastPlayerId = currentWordData.currentPlayer.id
        if (message.author.id === lastPlayerId) {
            message.delete()
            sendAutoDeleteMessageToChannel('Bạn đã trả lời lượt trước rồi, hãy đợi đối thủ!', configChannel)
            return
        }
    }



    if (words.length > 0) {
        const lastWord = words[words.length - 1]
        const args2 = lastWord.split(/\s+/).filter(Boolean)
        if (!(args1[0] === args2[args2.length - 1])) {
            message.react('❌')
            // sendMessageToChannel('Từ này không bắt đầu với tiếng `' + args2[args2.length - 1] + '`', configChannel)
            sendAutoDeleteMessageToChannel('Từ này không bắt đầu với tiếng `' + args2[args2.length - 1] + '`', configChannel)
            return
        }
    }

    if (checkIfWordUsed(tu)) {
        message.react('❌')
        sendAutoDeleteMessageToChannel('Từ này đã được sử dụng!', configChannel)
        return
    }

    if(!checkDict(tu)) {
        // check in dictionary
        message.react('❌')
        updateRankingForUser(0, 0, 1)
        // sendMessageToChannel('Từ này không có trong từ điển tiếng Việt!', configChannel)
        return
    }

    words.push(tu)
    wordDataChannel[configChannel].words = words
    wordDataChannel[configChannel].currentPlayer.id = message.author.id
    wordDataChannel[configChannel].currentPlayer.name = message.author.displayName

    fs.writeFileSync(wordDataPath, JSON.stringify(wordDataChannel))

    message.react('✅')

    // Nếu có người nối từ đúng trong thời gian bỏ phiếu, kết thúc bỏ phiếu
    if (ongoingVote[configChannel] && ongoingVote[configChannel].collector) {
        ongoingVote[configChannel].collector.stop(),
        sendAutoDeleteMessageToChannel('--- Đã có người nối từ đúng. Kết thúc bỏ phiếu ---', configChannel);
        delete ongoingVote[configChannel];
    }

    stats.addWordPlayedCount()

    updateRankingForUser(0, 1, 1)

    console.log(`[${message.guild.name}][${message.channel.name}][#${words.length}] ${tu}`)

    if(!checkIfHaveAnswerInDb(tu)) {
        sendMessageToChannel(`${message.author.displayName} đã chiến thắng sau ${words.length - 1} lượt! Lượt mới đã bắt đầu!`, configChannel)
        updateRankingForUser(1, 0, 0)
        stats.addRoundPlayedCount()
        initWordData(configChannel)
        startGame(configChannel)
        return
    }

    //fs.writeFileSync(queryPath, queryCount.toString())
    stats.addQuery(queryCount)
    return
})
// END LOGIC GAME

// The interactionCreate event directly here, as this is the heart of the robot.
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return
    const command = client.commands.get(interaction.commandName)
    if (!command) return

    // We log when a user makes a command
    try {
        await console.log(
            `[${interaction.guild.name}] ${interaction.user.username} used /${interaction.commandName}`
        )
        await command.execute(interaction, client)
        // But if there is a mistake, 
        // then we log that and send an error message only to the person (ephemeral: true)
    } catch (error) {
        console.error(error)
        return interaction.reply({
            content: "An error occurred while executing this command!",
            ephemeral: true,
            fetchReply: true
        })
    }
})

// The token of your robot to be inserted
client.login(process.env.BOT_TOKEN)
