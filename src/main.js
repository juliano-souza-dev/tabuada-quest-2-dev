import { Game } from './engine/Game.js';
import './styles/global.css';

const game = new Game({ mount: document.querySelector('#game') });
await game.start();
