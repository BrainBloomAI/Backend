const prompt = require("prompt-sync")({ sigint: true });
const { sequelize, User, Scenario } = require('./models');
require('dotenv').config()

async function resetDB() {
    console.log("Dropping tables...")
    try {
        await sequelize.drop()
        console.log("Tables dropped!")
    } catch (err) {
        console.error(err)
    }
}

async function softReset() {
    console.log("")
    const choice = prompt("This will destroy all records in the tables. Confirm soft reset? (y/n): ")
    if (choice !== 'y') {
        return
    }

    console.log("")
    console.log("Soft resetting...")
    try {
        await User.destroy({ where: {} })
        await Scenario.destroy({ where: {} })

        console.log("Tables soft resetted successfully!")
    } catch (err) {
        console.log(`Failed to soft reset tables; error: ${err}`)
    }
}

sequelize.sync({ alter: true })
    .then(async () => {
        const tools = (process.argv.slice(2)).map(t => t.toLowerCase())
        if (tools.length == 0) {
            console.log("No tool activated.")
            return
        }
        console.log(`Tools activated: ${tools.join(", ")}`)
        console.log()

        if (tools.includes("reset")) {
            await resetDB()
        }

        if (tools.includes("softreset")) {
            await softReset();
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })