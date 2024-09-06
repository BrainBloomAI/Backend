# API Documentation
This is the API documentation for all endpoints offered by the BrainBloomAI backend server.

BrainBloomAI Backend is a Express-based API server to create the logic and functionality for BrainBloomAI games and customers.
The system uses Sequelize ORM in a highly-configurable manner to allow for easy database management and manipulation.
Several internal services help power system operations and factorise/abstract common functionality.

The server has no public-facing webpages, except for a simple landing page.

Table of Contents:
- [System Configuration](#system-configuration)
- [Database Schemas](#database-schemas)
- [Authentication Flow](#authentication-flow)
- [Identity Management](#identity-management)
- [Game Management](#game-management)

# System Configuration

Setup requirements for server:
- `config/config.json` - File which can store multiple configurations for the server to use. System behaviour can be manipulated by changing values in this file. For standard operation, simply duplicate the `config/boilerplateConfig.json` file and rename it to `config/config.json`. You may need to change database connection information however. See [database configuration section](#database-configuration).
- `.env` - Stores environment variables for the server to use. These include dials to control the operation of certain parts of the system as well as sensitive information such as API keys. A `.env.example` has been provided for you to quickly fill in values for variables.
- `Node.js and NPM` - Ensure you have Node.js on your system. Run `npm install` to install all dependencies.

## Database Configuration

You can use the following configuration template (or alternatively copy from `boilerplateConfig.json`) to add/update configurations in your `config.json`.

```json
{
    "development": {
        "username": "root", // required (MySQL mode)
        "password": null, // required (MySQL mode)
        "database": "database_development", // required (MySQL mode)
        "host": "127.0.0.1", // required (MySQL mode)
        "dialect": "mysql", // required ('mysql', 'sqlite')
        "logging": true, // optional, default: console.log
        "loggingOptions": { // optional
            "logsFile": "sqlQueries.txt", // optional, default: 'sqlQueries.txt'. SQL query executions will be logged in this file if 'useFileLogging' is to true.
            "useFileLogging": false, // optional, default: false. Set to true to log SQL queries to file.
            "logPostBootOnly": false, // optional, default: false. Set to true to log SQL queries only after the system has booted.
            "clearUponBoot": false // optional, default: false. Set to true to clear the SQL query logs file upon boot.
        },
        "routeLogging": false, // optional, default: false. Set to true to log all incoming requests in the console.
        "routerRegistration": "manual" // optional, default: 'manual'. Set to 'automated' to automatically detect and register routes. Requires automated route export syntax.
    }
}
```

There's a few ways you can configure the database the backend system uses.

`DB_MODE` is a mandatory `.env` variable that needs to be set.

Database Modes:
- MySQL (`mysql`)
    - Set `DB_MODE` to `mysql` in `.env` file
    - Store your configuration details in `config/config.json`. You can rename and use `boilerplateConfig.json`.
    - You can create multiple configurations and switch between them by changing `DB_CONFIG` in `.env` file.
- Sqlite (`sqlite`)
    - Set `DB_MODE` to `sqlite` in `.env` file
    - `database.sqlite` file will be auto-created in root directory and used

### MySQL Mode

For each configuration, you need to provide:
- `username`
- `password`
- `database`
- `host`
- `dialect` (mysql)

Example configurations in `config/config.json`:
```json
{
    "rds": {
        "username": "AWSRelationalDatabaseServiceUser",
        "password": "password",
        "database": "mydatabase",
        "host": "mydatabase.x.us-east-1.rds.amazonaws.com",
        "dialect": "mysql"
    },
    "local": {
        "username": "root",
        "password": "password",
        "database": "mydatabase",
        "host": "localhost",
        "dialect": "mysql"
    }
}
```

Select your configuration by changing `DB_CONFIG` in `.env` file. For example, if I wanted the system to use my local MySQL server, I would set `DB_CONFIG=local`. Otherwise, if I wanted to use an AWS RDS instance, I would set `DB_CONFIG=rds`.

The value is the same as the key of your configuration in `config/config.json`.

### Sqlite Mode

No configuration is needed for Sqlite mode. The system will automatically create a `database.sqlite` file in the root directory and use it.

# Database Schemas

Note that responses may not always have the full schema of the object. Based on authorisation, optional parameters and other circumstances, responses may contain partial, formatted or additional information.

`User`:
- `userID` - Primary key.
- `username` - Unique username.
- `email` - Unique email.
- `password` - Hashed password.
- `role` - Role of the user. Can be either `standard` or `staff`. Staff can perform additional actions.
- `created` - ISO datetime string of account creation date.
- `lastLogin` - ISO datetime string of last login date. Used to compute sesison expiry. Nullable.
- `authToken` - Authentication token for the user. Used to authenticate requests. Nullable.
- `activeGame` - ID of the game the user is currently playing. Nullable.
- `banned` - Boolean value to indicate if the user is banned. Default is `false`.

`Scenario`:
- `scenarioID` - Primary key.
- `name` - Name of the scenario.
- `description` - Description of the scenario.
- `backgroundImage` - Name of the background image. Use this to interpolate into `${SERVERURL}/public/img/${backgroundImage}` to get the full URL.
- `created` - ISO datetime string of scenario creation date.

`Game`:
- `gameID` - Primary key.
- `scenarioID` - Foreign key to `Scenario`.
- `userID` - Foreign key to `User`.
- `startedTimestamp` - ISO datetime string of game start time.
- `status` - Status of the game. Can be either `'ongoing'`, `'abandoned'`, or `'complete'`.

`GameDialogue`:
- `dialogueID` - Primary key.
- `gameID` - Foreign key to `Game`.
- `by` - Who the dialogue is by. Can be either `'system'` or `'user'`.
- `attemptsCount` - Number of attempts made for the dialogue. Usually for the user only, since system-generated dialogues do not need re-attempts. Default is `0`.
- `successful` - Boolean value indicating whether any of the attempts for this dialogue were successful. Default is `false`.
- `createdTimestamp` - ISO datetime string of dialogue creation time.

`DialogueAttempt`:
- `attemptID` - Primary key.
- `dialogueID` - Foreign key to `GameDialogue`.
- `attemptNumber` - Number of the attempt. Should start from 1.
- `content` - Content of the attempt.
- `successful` - Boolean value indicating whether this attempt was successful. Default is `false`.
- `timestamp` - ISO datetime string of attempt creation time.
- `timeTaken` - Time taken in seconds as a double value to utter this attempt.

# Authentication Flow

Users can prove their identity to the server by using an authentication token. This token is unique system-wide and is provided upon a successful login.

Auth tokens are valid for 3 hours. Tokens should be refreshed 10 minutes before expiry to prevent session termination.

Steps to authenticate:
- POST to `/identity/login` with credentials to obtain authentication token.
- Use token as value of the header `authtoken` in all requests to the server which require authorisation.

# Identity Management

Endpoints at `/identity` offer comprehensive user management functionality.

## POST `/identity/new`

Authorisation required: NONE

Required fields:
- `username` - Username of the new user. Must be unique.
- `email` - Must be a valid email. Must be unique.
- `password` - Must be at least 8 characters long.
- `role` - Must be either `standard` or `staff`.

Sample request body:
```json
{
    "username": "johndoe",
    "email": "johndoe@example.com",
    "password": "12345678",
    "role": "standard"
}
```

Sample success response (account creation also logs user in automatically):
```
SUCCESS: Account created successfully. Authentication Token: AAAAAAAAAA
```

## POST `/identity/login`

Authorisation required: NONE

Required fields:
- `username` - Username of the user. Can be used instead of `email` field.
- `email` - Email of the user. Can be used instead of `username` field.
- `password` - Password of the user.

Sample request body:
```json
{
    "username": "johndoe",
    "password": "12345678"
}
```

Sample success response:
```
SUCCESS: Login successful. Authentication Token: AAAAAAAAAA
```

## POST `/identity/logout`

Authorisation required: YES

No required body fields.

Sample success response:
```
SUCCESS: Session terminated.
```

## GET `/identity/validateSession`

Authorisation required: YES

No required body fields.

Sample success response:
```
SUCCESS: Session validated.
```

## POST `/identity/refreshSession`

Authorisation required: YES

Should only be used 10 minutes before session expiry. This is not enforced, but is recommended.

No required body fields.

Sample success response:
```
SUCCESS: Session refreshed. Authentication Token: AAAAAAAAAA
```

## POST `/identity/delete`

Authorisation required: YES

Both staff and account owners are valid users to delete an account.

Staff require following fields:
- `targetUsername` - Username of the account to delete.

Account owners require no fields.

Sample request body for staff:
```json
{
    "targetUsername": "johndoe"
}
```

Sample success response:
```
SUCCESS: Account deleted.
```

# Game Management

Endpoints at `/game` offer comprehensive game management functionality. Games are fluid objects, with many sub-nested objects for the dialogue back and forths between the computer and the user.

Games are AI-generated interactions set in specific pre-set scenarios. The user responds to AI-generated prompts to practice making conversation at these kinds of scenarios. Using AI, inappropriate/irrelevant/inaccurate responses will be detected and the client will be told to re-try. A suggested AI generated response will be provided.

From a technical perspective, each `Scenario` can have many `Game`s. `Game`s belong to a `Scenario` (`scenarioID`) and a user (`userID`).

`Game`s can have many `GameDialogue`s (`gameID`), either from the user or the AI (`by` parameter, which is either `'system'` or `'user'`). `GameDialogue`s can have many `DialogueAttempt`s (`dialogueID`), which contain the actual content of the dialogue and whether it was a successful attempt or not, as well as other metadata.

## GET `/game/scenarios`

Authorisation required: NONE

No required body fields.

Sample success response:
```json
[
	{
		"scenarioID": "39b4db53-4a1a-4c02-bf2e-46a260268500",
		"name": "Cafetaria",
		"backgroundImage": "cafetaria.png",
		"description": "Cafetarias are places where you can buy food and drinks. This scenario is designed to simulate the interactions between a customer and a cashier.",
		"created": "2024-09-06T13:52:51.404Z",
		"createdAt": "2024-09-06T13:52:51.000Z",
		"updatedAt": "2024-09-06T13:52:51.000Z"
	},
	{
		"scenarioID": "de2617e6-b29f-4488-8828-d2abb8a87c5e",
		"name": "Retail",
		"backgroundImage": "retail.png",
		"description": "Retail stores are very commonplace. Whenever you need to buy some groceries or food, you may encounter interactions. This scenario is designed to simulate the interactions between a customer and a cashier.",
		"created": "2024-09-06T13:52:51.400Z",
		"createdAt": "2024-09-06T13:52:51.000Z",
		"updatedAt": "2024-09-06T13:52:51.000Z"
	}
]
```

## GET `/game`

Authorisation required: YES

Both staff and account owners can access this endpoint. Staff can access all games, and can also filter by user. Account owners can only access their own games, and can also choose to just see their active game.

All possible body fields:
- `targetUsername` - Only if you have staff privileges. Filters games by the user's username. Not providing this field will show all games.
- `activeGame` - Only for standard users. If set to `true`, will only show the user's active game. Will return an error message if there is no game currently active. If set to `false`, will show all of the user's games.
- `gameID` - Only for standard users. If set, will show the game with the specified ID. If not set, will show all games.
- `includeDialogues` - For all users. If set to `true`, will include all dialogues for each game. Default is `false`.

Sample request body for staff:
```json
{
    "targetUsername": "johndoe"
}
```

Sample request body for standard users:
```json
{
    "activeGame": true,
    "includeDialogues": true
}
```

Sample success body for standard users when showing active game with include dialogues enabled:
```json
{
	"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
	"startedTimestamp": "2024-09-06T14:47:44.434Z",
	"status": "ongoing",
	"userID": "f7eadd26-6922-4db0-a628-08d5c2afb49b",
	"scenarioID": "39b4db53-4a1a-4c02-bf2e-46a260268500",
	"dialogues": [
		{
			"dialogueID": "137dc223-84c4-47b4-8d73-85dccdaf4cab",
			"by": "system",
			"attemptsCount": 1,
			"successful": false,
			"createdTimestamp": "2024-09-06T14:47:44.439Z",
			"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
			"attempts": [
				{
					"attemptID": "7833c27a-eb51-46a4-8b4d-38bec3a914e3",
					"attemptNumber": 1,
					"content": "Hi! What's your name?",
					"successful": true,
					"timestamp": "2024-09-06T14:47:44.441Z",
					"timeTaken": 0,
					"dialogueID": "137dc223-84c4-47b4-8d73-85dccdaf4cab"
				}
			]
		},
		{
			"dialogueID": "9b562ede-7480-4616-b143-e174a3dfb981",
			"by": "user",
			"attemptsCount": 1,
			"successful": true,
			"createdTimestamp": "2024-09-06T14:47:46.501Z",
			"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
			"attempts": [
				{
					"attemptID": "e3a3618b-e7af-4f9e-9868-0286dd7d0081",
					"attemptNumber": 1,
					"content": "my name is john!",
					"successful": true,
					"timestamp": "2024-09-06T14:47:46.503Z",
					"timeTaken": 10,
					"dialogueID": "9b562ede-7480-4616-b143-e174a3dfb981"
				}
			]
		},
		{
			"dialogueID": "cd066915-6813-475d-9117-5abd59cc39f5",
			"by": "system",
			"attemptsCount": 1,
			"successful": false,
			"createdTimestamp": "2024-09-06T14:47:46.510Z",
			"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
			"attempts": [
				{
					"attemptID": "450c05bd-5bc2-4e37-838a-ea24552a9dfc",
					"attemptNumber": 1,
					"content": "Nice to meet you! Where are you from?",
					"successful": true,
					"timestamp": "2024-09-06T14:47:46.512Z",
					"timeTaken": 0,
					"dialogueID": "cd066915-6813-475d-9117-5abd59cc39f5"
				}
			]
		}
	]
}
```

Without include dialogues:
```json
{
	"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
	"startedTimestamp": "2024-09-06T14:47:44.434Z",
	"status": "ongoing",
	"userID": "f7eadd26-6922-4db0-a628-08d5c2afb49b",
	"scenarioID": "39b4db53-4a1a-4c02-bf2e-46a260268500"
}
```

## POST `/game/new`

Authorisation required: YES, Standard only.

If there's already an active game, you must abandon it first before creating a new one.

Required fields:
- `scenarioID` - ID of the scenario to start a new game in. Can be used instead of `scenarioName`.
- `scenarioName` - Name of the scenario to start a new game in. Can be used instead of `scenarioID`.

Sample request body:
```json
{
    "scenarioName": "Cafetaria"
}
```

Sample success reponse:
```json
{
	"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
	"startedTimestamp": "2024-09-06T14:47:44.434Z",
	"status": "ongoing",
	"userID": "f7eadd26-6922-4db0-a628-08d5c2afb49b",
	"scenarioID": "39b4db53-4a1a-4c02-bf2e-46a260268500",
	"dialogues": [
		{
			"dialogueID": "137dc223-84c4-47b4-8d73-85dccdaf4cab",
			"by": "system",
			"attemptsCount": 1,
			"successful": false,
			"createdTimestamp": "2024-09-06T14:47:44.439Z",
			"gameID": "36c0d4b9-5d4d-43a1-a69b-7a71f2d21c73",
			"attempts": [
				{
					"attemptID": "7833c27a-eb51-46a4-8b4d-38bec3a914e3",
					"attemptNumber": 1,
					"content": "Hi! What's your name?",
					"successful": true,
					"timestamp": "2024-09-06T14:47:44.441Z",
					"timeTaken": 0,
					"dialogueID": "137dc223-84c4-47b4-8d73-85dccdaf4cab"
				}
			]
		}
	]
}
```

## POST `/game/abandon`

Authorisation required: YES, Standard only.

No required body fields. Automatically detects active game and abandons it. Abandoned games are still associated with your account, but are just marked as abandoned (`status`).

If no active game is detected, an error message is returned.

Sample success response:
```
SUCCESS: Game abandoned.
```

## POST `/game/newDialogue`

Authorisation required: YES, Standard only.

This endpoint is a bit more complex. Here are the different kinds of situations/types of responses you may encounter:
- **Re-try prompt:** If the response you provided is inappropriate/irrelevant/inaccurate as deemed by AI, the system will ask you to re-try. The system will provide an AI-generated suggested response you can try as well.
- **Dialogue success:** If the response you provided was appropriate, the system will move on and provide you the next AI-generated dialogue prompt. (`aiResponse`).
- **Game complete:** If the system has no more dialogue prompts to provide, the game is marked as complete. It is no longer active. *Each conversation is only 4 AI prompts long.*

Required fields:
- `content` - Content of the dialogue attempt.
- `timeTaken` - Time taken to utter the dialogue attempt.
- `debugSuccess` (TEMPORARY) - Boolean value to force the system to mark the dialogue attempt as successful. Default is `false`.

Sample re-try success response:
```json
{
	"message": "SUCCESS: Great attempt but dialogue unsuccessful. Please retry.",
	"suggestedAIResponse": "Sample suggested AI response."
}
```

Sample dialogue success response:
```json
{
	"message": "SUCCESS: Dialogue successful. Please respond to follow-up AI dialogue.",
	"aiResponse": {
		"attemptID": "df717c2b-ab6d-45ba-88f2-7223a506a569",
		"dialogueID": "0e601637-6ec5-416d-8ec3-06aefdfd0717",
		"attemptNumber": 1,
		"content": "What would you like to order?",
		"successful": true,
		"timestamp": "2024-09-06T14:59:46.598Z",
		"timeTaken": 0,
		"updatedAt": "2024-09-06T14:59:46.598Z",
		"createdAt": "2024-09-06T14:59:46.598Z"
	}
}
```

Sample game complete response:
```json
{
	"message": "SUCCESS: Conversation complete. Thanks for playing!"
}
```

© 2024 BrainBloomAI Team. All rights reserved.