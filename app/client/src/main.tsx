import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "@colyseus/sdk/debug";
// Side-effect import: registers every @root/shared schema class with the
// client decoder so populated room state (e.g. `state.players`) deserializes.
import "@root/shared";

createRoot(document.getElementById('root')!).render(
    <App />
)
