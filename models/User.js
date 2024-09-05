const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['standard', 'staff']]
            }
        },
        created: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastLogin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        authToken: {
            type: DataTypes.STRING,
            allowNull: true
        },
        activeGame: {
            type: DataTypes.STRING,
            allowNull: true
        },
        banned: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        }
    }, { tableName: 'users' });

    // Associations
    User.associate = (models) => {
        User.hasMany(models.Game, {
            foreignKey: 'userID',
            as: 'playedGames',
            onDelete: 'cascade'
        })
    }

    // User.hook = (models) => {
        
    // }

    return User;
}