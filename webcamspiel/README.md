# Motion Arena (webcamspiel)

Webcam-Motion-Multisport-Spiel im Browser: Fruit Slasher, Basketball, Elfmeterschießen, Tennis.
Vanilla JS (ES-Module), keine Game Engine, kein Build-Schritt. Spezifikation: [GAME DEVELOPMENT PROMPT.md](GAME%20DEVELOPMENT%20PROMPT.md).

## Starten (localhost)

```powershell
.\start-dev.ps1            # Server auf http://localhost:8000 + Browser öffnen
.\start-dev.ps1 -Port 8080 -NoBrowser
# oder direkt:
python dev/serve.py 8000
```

`localhost` gilt als sicherer Kontext, daher funktioniert die Webcam ohne HTTPS.
HTTPS (für Tests vom Handy/LAN) folgt später.

MediaPipe (`@mediapipe/tasks-vision@0.10.14`) und die Modelle werden beim Aktivieren der Webcam
per CDN geladen – dafür ist Internet nötig. Ohne Kamera läuft alles per Maus/Tastatur.

## Smoke-Test (headless Chrome/Edge)

```powershell
.\dev\smoke.ps1                                   # alle Modi: simulierte Wischbewegungen, Runde beenden, JSON-Report
.\dev\smoke.ps1 -Game fruit-slasher -Screenshot C:\temp\fs.png   # ein Modus + PNG des letzten Frames
```

Exit-Code 1 bei JS-Fehlern. Im Browser manuell: `http://localhost:8000/index.html?smoke`.

## Struktur

```
index.html            Alle Screens (Menü, Einstellungen, Spiel + Overlay)
css/main.css
dev/serve.py          Dev-Server (stdlib, korrekte MIME-Types, kein Cache)
dev/smoke.js|ps1      Automatischer Smoke-Test
js/fx/effects.js      Partikel, Floating-Texte, Screen-Shake, Countdown-Text (für alle Modi)
js/main.js            Einstieg
js/core/              App-Steuerung, Loop, Canvas, Settings, Profile, Highscores, Storage
js/input/             InputManager (vereinheitlicht), Maus, Tastatur, CameraTracker (MediaPipe)
js/ui/                Menü, Einstellungen, HUD, Screen-Wechsel
js/games/             baseGame.js (Vertrag), registry.js, ein Ordner pro Spielmodus
                      calibration/ = Kalibrierung (nicht im Menü, Start aus den Einstellungen)
```

## Neuen Spielmodus hinzufügen

1. `js/games/<id>/index.js` anlegen, Klasse von `BaseGame` ableiten, `static meta` setzen
   (`id`, `title`, `description`, `color`, `tracking: { hands, pose }`,
   `options: { key: { label, default, choices: [[wert, text], ...] } }` → erscheinen im Setup-Screen).
2. `start()`, `update(dt, input)`, `render(ctx)`, `destroy()` implementieren, am Ende `this.finish({ score, stats })`.
3. In `js/games/registry.js` eintragen – Menü-Kachel, Highscores und Statistik kommen automatisch.

## Stand

- [x] Grundstruktur, Menü, Profile, Highscores, Einstellungen, Pause/Neustart/Menü
- [x] Setup-Screen pro Modus (Schwierigkeit, Optionen, Bestenliste)
- [x] Eingabe-Abstraktion: Maus/Touch, Tastatur, Webcam (Hand + Pose) mit automatischem Maus-Fallback
- [x] Fruit Slasher (Zeitlimit, Leben, Bomben, Combos, 3 Schwierigkeiten)
- [x] Kalibrierungsmodus (Einstellungen → „Kalibrieren“: 5 Zielpunkte mit dem Zeigefinger anzeigen, Versatz + Reichweite werden per Ausgleichsrechnung bestimmt; „Zurücksetzen“ stellt den Standard wieder her)
- [x] Basketball (Fangen + Wurf per Schwung, Ring/Brett-Physik, Netz, Dreier, Swish, Serien, wandernder Korb)
- [x] Elfmeterschießen (Egoperspektive, Schuss per Fuß-Kick via Pose, Maus/Tastatur mit Kraftbalken, Torwart-KI mit Reaktion + Antizipation der Lieblingsecke, Runden)
- [x] Tennis (Egoperspektive, Schläger per Hand, Richtung/Tempo/Spin aus der Schwungbewegung, Gegner-KI, 15/30/40/Einstand, Spiele, Sätze, Tiebreak, Match)
- [ ] Mit echter Webcam testen und Schwellwerte feinjustieren (Schnittgeschwindigkeit, Wurfschwung, Kick-Erkennung, Schlägerreichweite)
- [x] Menü: Statuszeile „Eingabe“ umbenennen in „Spielmodi“ und deutlich sichtbar machen, ob per Kamera oder Maus gespielt wird
- [x] Menü: Kamera direkt dort aktivierbar – Klick löst sofort die Browser-Abfrage zur Kameraerlaubnis aus (nicht erst über Einstellungen)
- [x] Kamerabild standardmäßig halbtransparent als Vollbild-Ebene über/unter dem Spielfeld, damit man sieht, wo sich Hände/Gelenke relativ zum Spielgeschehen bewegen
- [x] Einstellungen: Kameraanzeige wählbar – „halbtransparent Vollbild“ (Standard) oder „Vorschau unten rechts“
- [x] Einstellungen: Transparenz des Kamerabilds per Regler einstellbar
- [ ] Partikel/Animationen, Performance-Feinschliff
- [ ] HTTPS für LAN-Tests
