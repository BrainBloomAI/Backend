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
- `config/config.json` - File which can store multiple configurations for the server to use. System behaviour can be manipulated by changing values in this file. For standard operation, simply duplicate the `config/boilerplateConfig.json` file and rename it to `config/config.json`. You may need to change database connection information however. [See specific database configuration information here (reference to secondary project, only read relevant information)](https://github.com/MakanMatch/Backend/blob/main/ConfiguringSystem.md)
- `.env` - Stores environment variables for the server to use. These include dials to control the operation of certain parts of the system as well as sensitive information such as API keys. A `.env.example` has been provided for you to quickly fill in values for variables.
- `Node.js and NPM` - Ensure you have Node.js on your system. Run `npm install` to install all dependencies.

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

Both staff and account owners can access this endpoint.