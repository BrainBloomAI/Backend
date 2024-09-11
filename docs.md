# API and Setup Documentation
This is the API documentation for all endpoints offered by the BrainBloomAI backend server.

BrainBloomAI Backend is a Express-based API server to create the logic and functionality for BrainBloomAI games and customers.
The system uses Sequelize ORM in a highly-configurable manner to allow for easy database management and manipulation.
Several internal services help power system operations and factorise/abstract common functionality.

The server has no public-facing webpages, except for a simple landing page.

Table of Contents:
- [System Configuration](#system-configuration)
- [Database Schemas](#database-schemas)
- [Authentication Flow](#authentication-flow)
- [Gamification](#gamification)
- [Identity Management](#identity-management)
- [Staff Management](#staff-management)
- [Game Management](#game-management)

# System Configuration

Setup requirements for server:
- `config/config.json` - File which can store multiple configurations for the server to use. System behaviour can be manipulated by changing values in this file. For standard operation, simply duplicate the `config/boilerplateConfig.json` file and rename it to `config/config.json`. You may need to change database connection information however. See [database configuration section](#database-configuration).
- `.env` - Stores environment variables for the server to use. These include dials to control the operation of certain parts of the system as well as sensitive information such as API keys. A `.env.example` has been provided for you to quickly fill in values for variables.
- `Node.js and NPM` - Ensure you have Node.js on your system. Run `npm install` to install all dependencies.

## Cloud File Storage

The powerful `FileManager` sub-system is a complex file I/O, maintenance and consistency service that allows for easy file management and storage. The service creates, manages and uses a directory called `FileStore` for all of it's operations.

It is mainly used to store and retrieve background images for scenarios at the time of writing.

The service can work with Firebase Cloud Storage to make for a even more robust file management for the system. By default, the service will try to connect to Firebase Cloud Storage. There are, however, contingency fallbacks in place where the service pivots to local file storage.

Thus, there are two modes of operation for the system:
- Cloud mode (Default)
    - Connects to Firebase Cloud Storage bucket. Cloud is the ultimate source of truth, and smart on-demand principles will ensure cache efficiency and consistency of local `FileStore` directory.
	- Will automatically fall back to local mode in the event of misconfiguration or connection issues
	- `serviceAccountKey.json` file in root directory required.
	- `FIRESTORAGE_ENABLED` in `.env` set to `True`.
	- `STORAGE_URL` in `.env` set to Firebase Cloud Storage Bucket URL.
	- `FILEMANAGER_ENABLED` in `.env` set to `True`.
- Local mode
	- Standard local file storage and management is used. No external dependencies.
	- Will be backup option if cloud mode fails.
	- `FILEMANAGER_ENABLED` in `.env` set to `True`.
	- Can be configured to be the primary mode of operation by setting `FILEMANAGER_MODE` to `True` in the `.env` file.

The `serviceAccountKey.json` file is a Firebase service account private key. Obtain it by logging onto the Firebase console, navigating to Project Settings > Service Accounts > Generate New Private Key. Rename the file to `serviceAccountKey.json` and place it in the root directory.

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
- `points` - Points earned by the user. Default is `0`.
- `created` - ISO datetime string of account creation date.
- `lastLogin` - ISO datetime string of last login date. Used to compute sesison expiry. Nullable.
- `authToken` - Authentication token for the user. Used to authenticate requests. Nullable.
- `activeGame` - ID of the game the user is currently playing. Nullable.
- `mindsListening` - MINDS evaluation metric for listening. Nullable.
- `mindsEQ` - MINDS evaluation metric for emotional intelligence. Nullable d.
- `mindsTone` - MINDS evaluation metric for tone. Nullable d.
- `mindsHelpfulness` - MINDS evaluation metric for helpfulness. Nullable d.
- `mindsClarity` - MINDS evaluation metric for clarity. Nullable d.
- `mindsAssessment` - MINDS evaluation assessment. Nullable.
- `banned` - Boolean value to indicate if the user is banned. Default is `false`.

`Scenario`:
- `scenarioID` - Primary key.
- `name` - Name of the scenario.
- `description` - Description of the scenario.
- `backgroundImage` - Name of the background image. Use this to interpolate into `${SERVERURL}/public/img/${backgroundImage}` to get the full URL.
- `modelRole` - Role of the AI model in the scenario. Helps AI get a perspective when generating dialogues.
- `userRole` - Role of the user in the scenario. Helps AI get a perspective when responding to dialogues.
- `created` - ISO datetime string of scenario creation date.

`Game`:
- `gameID` - Primary key.
- `scenarioID` - Foreign key to `Scenario`.
- `userID` - Foreign key to `User`.
- `status` - Status of the game. Can be either `'ongoing'`, `'abandoned'`, or `'complete'`.
- `startedTimestamp` - ISO datetime string of game start time.
- `pointsEarned` - Integer value of points earned in the game. Nullable.

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

`GameEvaluation`:
- `evaluationID` - Primary key.
- `associatedGameID` - Foreign key to `Game`. Optional relationship from `Game` to `GameEvaluation`.
- `listening` - AI-estimated evaluation metric for listening. Nullable.
- `eq` - AI-estimated evaluation metric for emotional intelligence. Nullable.
- `tone` - AI-estimated evaluation metric for tone. Nullable.
- `helpfulness` - AI-estimated evaluation metric for helpfulness. Nullable.
- `clarity` - AI-estimated evaluation metric for clarity. Nullable.
- `simpleDescription` - Simple description of the evaluation. Should be shown to the user. Nullable.
- `fullDescription` - Full description of the evaluation. Should be shown to staff. Nullable.

# Authentication Flow

Users can prove their identity to the server by using an authentication token. This token is unique system-wide and is provided upon a successful login.

Auth tokens are valid for 3 hours. Tokens should be refreshed 10 minutes before expiry to prevent session termination.

Steps to authenticate:
- POST to `/identity/login` with credentials to obtain authentication token.
- Use token as value of the header `authtoken` in all requests to the server which require authorisation.

# Gamification

Users of BrainBloomAI are encouraged to play more games and keep their training up through a points-based incentive program.

After completing games, based on how well they did in the game, points will be awarded to the user's profile. These points can be redeemed for badges or other rewards (not implemented yet).

Points are awarded based on the following criteria:
- Game completion: 10 points
- Zero failed attempts in an entire game: 5 points
- Passing evaluation metrics (> 80): 3 points/metric (15 points maximum)

This means that the user can earn a maximum of 30 points per completed game. Total points are stored in the `points` field of the `User` model.

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

# Staff Management

Accounts with staff privilieges (`role` = `'staff'`) can carry out actions like key in MINDS evaluation metrics in client profiles and more. Keying in further evaluation data helps digitise the evaluation data, personalise the client's game experience and allow for more accurate evaluation of client progress.

Aside the endpoints below, staff can also delete client accounts with a POST request to `/identity/delete` ([see this](#post-identitydelete)). Staff can access game data as well; [see this.](#get-game)

## POST `/staff/viewClients`

Authorisation required: YES, Staff only.

No required body fields. Retrieves all clients in the system and their respective data, including MINDS evaluation metrics.

Sample success response:
```json
[
	{
		"userID": "4005c2f4-f0d9-43e6-b0c8-4ef389c189ed",
		"username": "someuser",
		"email": "email@example.com",
		"created": "2024-09-09T09:34:09.029Z",
		"lastLogin": "2024-09-09T10:21:01.662Z",
		"activeGame": null,
		"mindsListening": 40,
		"mindsEQ": 30,
		"mindsTone": 90,
		"mindsHelpfulness": 80,
		"mindsClarity": 60,
		"mindsAssessment": "Good listener, but needs to work on clarity and tone.",
		"banned": false
	}
]
```

## POST `/staff/banClient`

Authorisation required: YES, Staff only.

Required fields:
- `targetUsername` - Username of the standard account to ban.

Sample request body:
```json
{
	"targetUsername": "someuser"
}
```

Sample success response:
```
SUCCESS: Client banned.
```

## POST `/staff/unbanClient`

Authorisation required: YES, Staff only.

Required fields:
- `targetUsername` - Username of the standard account to unban.

Sample request body:
```json
{
	"targetUsername": "someuser"
}
```

Sample success response:
```
SUCCESS: Client unbanned.
```

## POST `/staff/updateMindsEvaluation`

Authorisation required: YES, Staff only.

Required fields:
- `targetUsername` - Username of the standard account to update.
- `listening` - Listening metric. Must be a double value between 0 and 100.
- `eq` - Emotional intelligence metric. Must be a double value between 0 and 100.
- `tone` - Tone metric. Must be a double value between 0 and 100.
- `helpfulness` - Helpfulness metric. Must be a double value between 0 and 100.
- `clarity` - Clarity metric. Must be a double value between 0 and 100.
- `assessment` - Assessment of the client. Must be a string.

Sample request body:
```json
{
	"targetUsername": "someuser",
	"listening": 40,
	"eq": 30,
	"tone": 90,
	"helpfulness": 80,
	"clarity": 60,
	"assessment": "Good listener, but needs to work on clarity and tone."
}
```

Sample success response:
```
SUCCESS: MINDS evaluation updated.
```

## POST `/staff/removeEvaluation`

Authorisation required: YES, Staff only.

Required fields:
- `targetUsername` - Username of the standard account to remove evaluation data from.

Sample request body:
```json
{
	"targetUsername": "someuser"
}
```

Sample success response:
```
SUCCESS: MINDS evaluation removed.
```

## GET `/scenario`

(Same as [GET `/game/scenarios`](#get-gamescenarios))

Authorisation required: NONE

No required body fields. Retrieves all scenarios in the system.

Sample success response body:
```json
[
	{
		"scenarioID": "2f183b1f-681a-4e38-a359-80fd25d4d743",
		"name": "Retail Customer Service",
		"backgroundImage": "retail.png",
		"description": "An AI customer will ask for help when searching for something specific in a retail store. Learn to respond courteously and in an easy-to-understand manner as a retail worker in the store.",
		"modelRole": "customer",
		"userRole": "retail worker",
		"created": "2024-09-11T15:38:48.287Z",
		"createdAt": "2024-09-11T15:38:48.000Z",
		"updatedAt": "2024-09-11T15:40:31.000Z"
	},
	{
		"scenarioID": "62b140f9-ea94-47ee-8d0a-868745319933",
		"name": "Peer Conversation",
		"backgroundImage": "peerconvo.png",
		"description": "Talk to an AI peer from school about a random topic. Learn to engage in conversation and response naturally in peer-to-peer conversations.",
		"modelRole": "classmate",
		"userRole": "student",
		"created": "2024-09-11T15:40:03.706Z",
		"createdAt": "2024-09-11T15:40:03.000Z",
		"updatedAt": "2024-09-11T15:40:03.000Z"
	},
	{
		"scenarioID": "8f8be105-fcdd-4f8c-bfd9-2f7f42c98f97",
		"name": "Cafetaria Food Order",
		"backgroundImage": "cafetaria.png",
		"description": "An AI customer will order food from you in a cafetaria. Understand the complexity of taking orders and responding as a vendor in the cafetaria.",
		"modelRole": "customer",
		"userRole": "vendor",
		"created": "2024-09-11T15:38:48.291Z",
		"createdAt": "2024-09-11T15:38:48.000Z",
		"updatedAt": "2024-09-11T15:38:48.000Z"
	}
]
```

## POST `/scenario/new`

Authorisation required: YES, Staff only.

Required fields (**Multi-part form data**):
- `name` - Name of the scenario.
- `description` - Description of the scenario.
- `image` - Image file of the background image for this scenario.
- `modelRole` - Role of the AI model in the scenario.
- `userRole` - Role of the user in the scenario.

Sample multi-part request body:

<img width="594" alt="Screenshot 2024-09-12 at 12 48 17 AM" src="https://github.com/user-attachments/assets/49cba4d1-deec-4f94-8c7e-0c717bc632ac">

Sample success response:
```json
{
	"message": "SUCCESS: Scenario created successfully.",
	"newScenario": {
		"scenarioID": "6cf6f2cf-eb54-4e21-9d1c-0576ab5cd92b",
		"name": "SampleNewScenario",
		"backgroundImage": "e049ce3d-82e3-4b07-9bed-552e265e2e53.png",
		"description": "This is a sample scenario.",
		"modelRole": "Mother",
		"userRole": "John",
		"created": "2024-09-11T07:13:38.316Z"
	}
}
```

## POST `/scenario/enforceDefaults`

Authorisation required: YES, Staff only.

No required body fields. Will automatically enforce the default scenarios hard-coded in the system.

Sample success response:
```
SUCCESS: Default scenarios enforced successfully.
```

## DELETE `/scenario/delete`

Authorisation required: YES, Staff only.

Required fields:
- `scenarioID` - ID of the scenario to delete. Can be used instead of `scenarioName` field.
- `scenarioName` - Name of the scenario to delete. Can be used instead of `scenarioID` field.

Sample request body:
```json
{
	"scenarioID": "6cf6f2cf-eb54-4e21-9d1c-0576ab5cd92b"
}
```

Sample success response:
```
SUCCESS: Scenario deleted successfully.
```

## POST `/scenario/update`

Authorisation required: YES, Staff only.

Required fields:
- `scenarioID` - ID of the scenario to update.

Optional fields:
- `name` - Name of the scenario.
- `description` - Description of the scenario.
- `image` - Image file of the background image for this scenario.
- `modelRole` - Role of the AI model in the scenario.
- `userRole` - Role of the user in the scenario.

Sample multi-part request body:

<img width="594" alt="Screenshot 2024-09-12 at 12 51 14 AM" src="https://github.com/user-attachments/assets/ba70bf2f-6198-4bbc-bc1d-4a6c69a11d92">

Sample success response:
```json
{
	"message": "SUCCESS: Scenario updated successfully.",
	"newScenario": {
		"scenarioID": "6cf6f2cf-eb54-4e21-9d1c-0576ab5cd92b",
		"name": "SampleNewScenario",
		"backgroundImage": "467e864a-11f1-4dbc-9533-25ad45b5f945.jpg",
		"description": "This is a sample scenario.",
		"modelRole": "Mother",
		"userRole": "Oliver",
		"created": "2024-09-11T07:13:38.316Z"
	}
}
```

# Game Management

Endpoints at `/game` offer comprehensive game management functionality. Games are fluid objects, with many sub-nested objects for the dialogue back and forths between the computer and the user.

Games are AI-generated interactions set in specific pre-set scenarios. The user responds to AI-generated prompts to practice making conversation at these kinds of scenarios. Using AI, inappropriate/irrelevant/inaccurate responses will be detected and the client will be told to re-try. A suggested AI generated response will be provided. Thus, an OpenAI API key is required to be configured beforehand.

From a technical perspective, each `Scenario` can have many `Game`s. `Game`s belong to a `Scenario` (`scenarioID`) and a user (`userID`).

`Game`s can have many `GameDialogue`s (`gameID`), either from the user or the AI (`by` parameter, which is either `'system'` or `'user'`). `GameDialogue`s can have many `DialogueAttempt`s (`dialogueID`), which contain the actual content of the dialogue and whether it was a successful attempt or not, as well as other metadata.

## GET `/game/scenarios`

Authorisation required: NONE

No required body fields.

Sample success response:
```json
[
	{
		"scenarioID": "2f183b1f-681a-4e38-a359-80fd25d4d743",
		"name": "Retail Customer Service",
		"backgroundImage": "retail.png",
		"description": "An AI customer will ask for help when searching for something specific in a retail store. Learn to respond courteously and in an easy-to-understand manner as a retail worker in the store.",
		"modelRole": "customer",
		"userRole": "retail worker",
		"created": "2024-09-11T15:38:48.287Z",
		"createdAt": "2024-09-11T15:38:48.000Z",
		"updatedAt": "2024-09-11T15:40:31.000Z"
	},
	{
		"scenarioID": "62b140f9-ea94-47ee-8d0a-868745319933",
		"name": "Peer Conversation",
		"backgroundImage": "peerconvo.png",
		"description": "Talk to an AI peer from school about a random topic. Learn to engage in conversation and response naturally in peer-to-peer conversations.",
		"modelRole": "classmate",
		"userRole": "student",
		"created": "2024-09-11T15:40:03.706Z",
		"createdAt": "2024-09-11T15:40:03.000Z",
		"updatedAt": "2024-09-11T15:40:03.000Z"
	},
	{
		"scenarioID": "8f8be105-fcdd-4f8c-bfd9-2f7f42c98f97",
		"name": "Cafetaria Food Order",
		"backgroundImage": "cafetaria.png",
		"description": "An AI customer will order food from you in a cafetaria. Understand the complexity of taking orders and responding as a vendor in the cafetaria.",
		"modelRole": "customer",
		"userRole": "vendor",
		"created": "2024-09-11T15:38:48.291Z",
		"createdAt": "2024-09-11T15:38:48.000Z",
		"updatedAt": "2024-09-11T15:38:48.000Z"
	}
]
```

## GET `/game`

Authorisation required: YES

Both staff and account owners can access this endpoint. Staff can access all games, and can also filter by user. Account owners can only access their own games, and can also choose to just see their active game.

All possible query parameter fields:
- `targetUsername` - Only if you have staff privileges. Filters games by the user's username. Not providing this field will show all games.
- `activeGame` - Only for standard users. If set to `true`, will only show the user's active game. Will return an error message if there is no game currently active. If set to `false`, will show all of the user's games.
- `gameID` - For all users. If set, will show the game with the specified ID. If not set, will show all games.
- `includeDialogues` - For all users. If set to `true`, will include all dialogues for each game. Default is `false`.
- `includeScenario` - For all users. If set to `true`, scenario data will be included under `scenario` parameter. Default is `false`.
- `includeEvaluation` - For all users. If set to `true`, evaluation data will be included under `evaluation` parameter. Default is `false`. Do note that some games may not have evaluations just yet, in which case the parameter's value will be `null`.
- `includeSimpleConversationLog` - For all users. If set to `true`, a chronologically ordered array of objects containing each actual dialogue message and who it was from will be provided under the `conversationLog` parameter. Can help to easily understand the coonversation flow in a game. Default is `false`. Note that unsuccessful dialogue attempts are not included.

Sample request query string for staff:
```
${origin}/game?targetUsername=someuser
```

Sample request query for standard users:
```
${origin}/game?activeGame=true&includeDialogues=true&includeEvaluation=true
```

For this sample request query from a standard user:
```
${origin}/game?includeDialogues=true&includeEvaluation=true&includeScenario=true&activeGame=false&includeSimpleConversationLog=true
```

Here's an example success response body:
```json
[
	{
		"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
		"startedTimestamp": "2024-09-11T14:36:49.913Z",
		"status": "complete",
		"pointsEarned": 25,
		"userID": "f7eaf051-f093-418a-891d-204d2dfd40f5",
		"scenarioID": "5666e7f1-ec04-4325-9618-b84116f9b4eb",
		"dialogues": [
			{
				"dialogueID": "1912d248-8f50-42d7-8fd4-f4d6847a2bc8",
				"by": "user",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:38:03.887Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "db73169e-098e-4e11-adf4-9a76da5abfd5",
						"attemptNumber": 1,
						"content": "Mainly how to do a reverse flip, ollies and stuff like that. What have you been up to?",
						"successful": true,
						"timestamp": "2024-09-11T14:38:03.899Z",
						"timeTaken": 10,
						"dialogueID": "1912d248-8f50-42d7-8fd4-f4d6847a2bc8"
					}
				]
			},
			{
				"dialogueID": "22e4f75d-bd70-4cbc-a07e-1864f8e1c7c5",
				"by": "user",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:37:37.186Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "7df1bf0a-5a50-46e2-83e6-58d1db1ce82a",
						"attemptNumber": 1,
						"content": "Not yet, but I'm making good progress. I met a new guy who's really good at some tricks last week, he's teaching me",
						"successful": true,
						"timestamp": "2024-09-11T14:37:37.189Z",
						"timeTaken": 10,
						"dialogueID": "22e4f75d-bd70-4cbc-a07e-1864f8e1c7c5"
					}
				]
			},
			{
				"dialogueID": "41474bfa-fe0e-4d7b-a4a2-ef0b67e4c5c9",
				"by": "system",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:36:50.576Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "b5025736-ce05-49db-9dfa-fa8db0f9c74e",
						"attemptNumber": 1,
						"content": "Hey! How's it going today? Did you do anything fun after school?",
						"successful": true,
						"timestamp": "2024-09-11T14:36:50.580Z",
						"timeTaken": 0,
						"dialogueID": "41474bfa-fe0e-4d7b-a4a2-ef0b67e4c5c9"
					}
				]
			},
			{
				"dialogueID": "5f091482-a9fd-4cd4-a2fd-33dbda3491f8",
				"by": "system",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:37:14.907Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "cffdcafe-778e-4a05-bc22-35823555b8f5",
						"attemptNumber": 1,
						"content": "That sounds like so much fun! Did you learn any new tricks on your roller skates?",
						"successful": true,
						"timestamp": "2024-09-11T14:37:14.911Z",
						"timeTaken": 0,
						"dialogueID": "5f091482-a9fd-4cd4-a2fd-33dbda3491f8"
					}
				]
			},
			{
				"dialogueID": "81bfcaf8-ed9d-473b-a961-ae2ed6acc5aa",
				"by": "user",
				"attemptsCount": 2,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:36:52.291Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "6edf5586-d3f3-4a9c-82f9-c8959a4ce0b7",
						"attemptNumber": 2,
						"content": "I'm great! After school, took the roller skates out for a bit at the park!",
						"successful": true,
						"timestamp": "2024-09-11T14:37:13.775Z",
						"timeTaken": 10,
						"dialogueID": "81bfcaf8-ed9d-473b-a961-ae2ed6acc5aa"
					},
					{
						"attemptID": "f550b02f-4427-4c93-bff8-86aaab123e6a",
						"attemptNumber": 1,
						"content": "I really like plants",
						"successful": false,
						"timestamp": "2024-09-11T14:36:52.293Z",
						"timeTaken": 10,
						"dialogueID": "81bfcaf8-ed9d-473b-a961-ae2ed6acc5aa"
					}
				]
			},
			{
				"dialogueID": "99944d58-385b-4339-871c-00e7272f4873",
				"by": "system",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:37:38.269Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "a0f54a42-e4ab-487d-9f67-dbf7ae44aea4",
						"attemptNumber": 1,
						"content": "That's awesome! What kind of tricks are you hoping to learn from him?",
						"successful": true,
						"timestamp": "2024-09-11T14:37:38.271Z",
						"timeTaken": 0,
						"dialogueID": "99944d58-385b-4339-871c-00e7272f4873"
					}
				]
			},
			{
				"dialogueID": "a1f2b1f1-b13d-4df5-8831-392d1494e0c9",
				"by": "system",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:38:05.130Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "78bd65bd-57ba-4ffe-8b40-34573b2e46c8",
						"attemptNumber": 1,
						"content": "That sounds really cool! I’ve just been hanging out with friends and playing video games. Let’s chat again soon!",
						"successful": true,
						"timestamp": "2024-09-11T14:38:05.135Z",
						"timeTaken": 0,
						"dialogueID": "a1f2b1f1-b13d-4df5-8831-392d1494e0c9"
					}
				]
			},
			{
				"dialogueID": "fb5c3825-39f4-48a1-86fb-c534d2a834de",
				"by": "user",
				"attemptsCount": 1,
				"successful": true,
				"createdTimestamp": "2024-09-11T14:38:14.900Z",
				"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
				"attempts": [
					{
						"attemptID": "e5e3ce6a-9616-45ea-a875-e2e2148d46ab",
						"attemptNumber": 1,
						"content": "For sure! See you tomorrow!",
						"successful": true,
						"timestamp": "2024-09-11T14:38:14.904Z",
						"timeTaken": 10,
						"dialogueID": "fb5c3825-39f4-48a1-86fb-c534d2a834de"
					}
				]
			}
		],
		"scenario": {
			"scenarioID": "5666e7f1-ec04-4325-9618-b84116f9b4eb",
			"name": "Peer Conversation",
			"backgroundImage": "peerconvo.png",
			"description": "Talk to an AI peer from school about a random topic. Learn to engage in conversation and response naturally in peer-to-peer conversations.",
			"modelRole": "classmate",
			"userRole": "student",
			"created": "2024-09-11T10:02:12.371Z"
		},
		"evaluation": {
			"evaluationID": "3d0943c9-fc51-4ad6-8d95-90c561282083",
			"listening": 85,
			"eq": 80,
			"tone": 90,
			"helpfulness": 85,
			"clarity": 95,
			"simpleDescription": "You did a great job talking about your interests and asking questions! Keep practicing to make conversations even better.",
			"fullDescription": "The user showed good listening skills and engaged well with the classmate. They asked relevant questions and shared personal interests, which helped maintain the flow of conversation. Encourage the user to keep practicing follow-up questions to deepen discussions. Also, remind them to occasionally check in on the other person's feelings or experiences to enhance emotional connections. Overall, they are making great progress in social interactions!",
			"associatedGameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2"
		},
		"conversationLog": [
			{
				"by": "system",
				"content": "Hey! How's it going today? Did you do anything fun after school?"
			},
			{
				"by": "user",
				"content": "I'm great! After school, took the roller skates out for a bit at the park!"
			},
			{
				"by": "system",
				"content": "That sounds like so much fun! Did you learn any new tricks on your roller skates?"
			},
			{
				"by": "user",
				"content": "Not yet, but I'm making good progress. I met a new guy who's really good at some tricks last week, he's teaching me"
			},
			{
				"by": "system",
				"content": "That's awesome! What kind of tricks are you hoping to learn from him?"
			},
			{
				"by": "user",
				"content": "Mainly how to do a reverse flip, ollies and stuff like that. What have you been up to?"
			},
			{
				"by": "system",
				"content": "That sounds really cool! I’ve just been hanging out with friends and playing video games. Let’s chat again soon!"
			},
			{
				"by": "user",
				"content": "For sure! See you tomorrow!"
			}
		]
	}
]
```

Without all optional sub-datasets included:
```json
[
	{
		"gameID": "85eb9457-4539-4780-9db3-e6c2ec47e2d2",
		"startedTimestamp": "2024-09-11T14:36:49.913Z",
		"status": "complete",
		"pointsEarned": 25,
		"userID": "f7eaf051-f093-418a-891d-204d2dfd40f5",
		"scenarioID": "5666e7f1-ec04-4325-9618-b84116f9b4eb"
	}
]
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
- **Dialogue success:** If the response you provided was appropriate, the system will move on and provide you the next AI-generated dialogue prompt (`aiResponse`).
- **Game complete:** If the system has no more dialogue prompts to provide, the game is marked as complete. It is no longer active.

Take note that each game is only 4 AI prompts long, or a total of 8 dialogues from both the system and the user. The last prompt generated by the AI will intentionally sound like a conversation closer, so that the interaction can be brought to a natural end.

If the final `newDialogue` request of a game is successful, the following occur in sequence:
1. The game is marked as complete.
2. The game is de-linked from the user's profile as the active game.
3. Based on the entire conversation log, the AI sub-system evaluates the performance of the user across specific metric domains specified in the `GameEvaluation` table.
4. The new evaluation data is created as a new record in the `GameEvaluation` table.
5. Based on the gamification scheme described [here](#gamification), points are awarded to the user. The game's `pointsEarned` field is updated and the `user`'s `points` field is supplemented.
6. A game completion response is returned to the client with the number of points earned and the simple feedback from the `GameEvaluation`.

If, for some reason, the AI evaluation of the game fails, the response will just be a game completion message, which also informs the client that the AI evaluation was unfortunately unsuccessful.

In this case, the client can request an AI evaluation of the game (provide the `gameID`) to [the `/game/requestEvaluation` endpoint](#post-gamerequestevaluation).

Required fields:
- `content` - Content of the dialogue attempt.
- `timeTaken` - Time taken to utter the dialogue attempt.
- `debugSuccess` (FOR DEBUG USE ONLY) - Boolean value to force the system to mark the dialogue attempt as successful. Default is `false`.

Sample request body:
```json
{
	"content": "I hate you",
	"timeTaken": 10.0
}
```

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
	"message": "SUCCESS: Conversation complete. Thanks for playing!",
	"pointsEarned": 25,
	"feedback": "You did a great job talking about your interests and asking questions! Keep practicing to make conversations even better."
}
```

Sample game complete response where game's AI evaluation was unsuccessful:
```json
{
	"message": "SUCCESS: Conversation complete. Thanks for playing! Something went wrong in evaluating your performance. Please try again later."
}
```

## POST `/game/requestEvaluation`

Authorisation required: YES

Both staff and standard users can access this endpoint. Staff can request evaluations regardless of whether an evaluation has already been done, in which case the old evaluation is deleted

© 2024 BrainBloomAI Team. All rights reserved.
