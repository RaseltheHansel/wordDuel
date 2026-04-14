import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class GameResult extends Model { 
    declare id: number; 
    declare roomId: string;
    declare word: string;
    declare winnerId: number;
    declare loserId: number;
    declare winnerGuesses: number;
    declare durationMs: number;
    declare player1Id: number;
    declare player2Id: number;

}

GameResult.init({
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    roomId: {type: DataTypes.STRING, allowNull: false},
    word: {type: DataTypes.STRING, allowNull: false},
    winnerId: {type: DataTypes.INTEGER, allowNull: false},
    loserId: {type: DataTypes.INTEGER, allowNull: false},
    winnerGuesses: {type: DataTypes.INTEGER, allowNull: false},
    durationMs: {type: DataTypes.INTEGER, allowNull: false},
    player1Id: {type: DataTypes.INTEGER, allowNull: false},
    player2Id: {type: DataTypes.INTEGER, allowNull: false}
}, {
    sequelize,
    tableName: 'game_results',
    timestamps: true
});

export default GameResult;