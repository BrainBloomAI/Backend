# API Documentation
This is the API documentation for all endpoints offered by the BrainBloomAI backend server.

BrainBloomAI Backend is a Express-based API server to create the logic and functionality for BrainBloomAI games and customers.
The system uses Sequelize ORM in a highly-configurable manner to allow for easy database management and manipulation.
Several internal services help power system operations and factorise/abstract common functionality.

The server has no public-facing webpages, except for a simple landing page.

Table of Contents:
- [System Configuration](#system-configuration)
- [Authentication Flow](#authentication-flow)
- [Identity Management](#identity-management)
- [Game Management](#game-management)

# System Configuration

Setup requirements for server:
- `config/config.json` - File which can store multiple configurations for the server to use. System behaviour can be manipulated by changing values in this file. For standard operation, simply duplicate the `config/boilerplateConfig.json` file and rename it to `config/config.json`. You may need to change database connection information however. [See specific database configuration information here (reference to secondary project, only read relevant information)](https://github.com/MakanMatch/Backend/blob/main/ConfiguringSystem.md)
- `.env` - Stores environment variables for the server to use. These include dials to control the operation of certain parts of the system as well as sensitive information such as API keys. A `.env.example` has been provided for you to quickly fill in values for variables.
- `Node.js and NPM` - Ensure you have Node.js on your system. Run `npm install` to install all dependencies.

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