import { GameApp } from './app/GameApp.js';
import './styles/global.css';

const app = new GameApp({ mount: document.querySelector('#game') });
await app.start();
