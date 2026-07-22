import { useState, useRef, useCallback, useEffect } from "react";
import { AudioEngine } from "../audio.js";

export function useVictoryCanvas({ screen }) {
  const [victoryRevealed, setVictoryRevealed] = useState(false);
  const victoryCanvasRef = useRef(null);
  const victoryDrawing = useRef(false);

  useEffect(() => {
    if (screen !== "victory" || victoryRevealed) return;
    const canvas = victoryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0,   "#b8860b");
    grad.addColorStop(0.25,"#f5d060");
    grad.addColorStop(0.5, "#c8a020");
    grad.addColorStop(0.75,"#f0e080");
    grad.addColorStop(1,   "#b8860b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // subtle crosshatch texture
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 8) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 8) {
      ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(canvas.width,j); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = `bold 15px "Courier New"`;
    ctx.textAlign = "center";
    ctx.fillText("✦ GRATTA PER SCOPRIRE IL TUO DESTINO ✦", canvas.width/2, canvas.height/2 - 8);
    ctx.fillText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", canvas.width/2, canvas.height/2 + 10);
    ctx.font = `12px "Courier New"`;
    ctx.fillText("[ usa il dito o il cursore ]", canvas.width/2, canvas.height/2 + 30);
  }, [screen, victoryRevealed]);

  const handleVictoryScratch = useCallback((clientX, clientY) => {
    if (victoryRevealed) return;
    const canvas = victoryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top)  * (canvas.height / rect.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();
    AudioEngine.scratch();
    // check % revealed
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transp = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i] < 128) transp++; }
    if (transp / (canvas.width * canvas.height) > 0.52) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setVictoryRevealed(true);
      AudioEngine.bossEntrance();
    }
  }, [victoryRevealed]);

  return { victoryRevealed, setVictoryRevealed, victoryCanvasRef, victoryDrawing, handleVictoryScratch };
}
