# GAME DEVELOPMENT PROMPT

Entwickle ein vollständiges, webbasiertes Motion-Control-Multisport-Spiel. Keine externe Game Engine. Arbeite direkt an der Implementierung und liefere funktionierenden Code statt bloßer Konzepte.

## 1. TECHNIK
- HTML, CSS, JavaScript (bevorzugt Vanilla JS).
- Keine externe Game Engine.
- Webcam als primärer Input: Körper-, Arm-, Hand- und Beinbewegungen erkennen.
- Maus und Tastatur als alternative Steuerung.
- Geeignete Browser-Technologien/Libraries für Echtzeit-Pose- und Handtracking verwenden.
- Flüssige Performance, geringe Latenz, responsive Darstellung.
- Webcam-Verarbeitung möglichst lokal im Browser.
- Kalibrierung, Sensitivität und Spiegelmodus.
- Bei fehlender Webcam automatisch auf Maussteuerung umschalten.

## 2. SPIELMODI

### A) FRUIT SLASHER
- Früchte erscheinen und fallen von oben.
- Durch Arm-/Handbewegungen Früchte zerschneiden.
- Schnittbewegung und Treffer zuverlässig erkennen.
- Punkte, Combos, Zeitlimit, Highscore.
- Bomben als Hindernisse.
- Verschiedene Schwierigkeitsstufen.

### B) BASKETBALL
- Basketbälle erscheinen und fliegen von oben ins Spielfeld.
- Spieler wirft sie durch Hand-/Armbewegungen in den Korb.
- Realistische Flugbahn und Trefferphysik.
- Spielzeit einstellbar: 30 Sekunden bis 60 Minuten.
- Punkte, Trefferquote, Fehlwürfe, Highscore.
- Verschiedene Schwierigkeitsstufen.

### C) ELFMETERSCHIESSEN (FUSSBALL)
- Egoperspektive mit Blick auf das Tor.
- 10 Bälle liegen bereit.
- Schusssteuerung primär über Bein-/Fußbewegungen via Webcam.
- Maus-/Tastaturalternative.
- Anzahl der Runden einstellbar.
- Intelligenter Torwart, der Schüsse antizipiert und abwehrt.
- Schussrichtung, Präzision und Stärke berücksichtigen.
- Highscores und Spielerstatistiken (Tore, Fehlversuche, Quote).

### D) TENNIS
- Egoperspektive.
- Schlägerbewegung über Arm-/Handtracking.
- Maus-/Tastaturalternative.
- Ballphysik mit Geschwindigkeit, Spin und Flugbahn.
- Gegner mit anpassbarer KI.
- Punkte-, Satz- und Matchsystem.
- Verschiedene Schwierigkeitsstufen.

## 3. MENÜ & SPIELVERWALTUNG
- Modernes, hochwertiges Gaming-Hauptmenü.
- Alle Spielmodi als auswählbare Kacheln.
- Spielerprofile und individuelle Statistiken.
- Highscore-System pro Spielmodus.
- Schwierigkeitsgrad und Spielparameter einstellbar.
- Webcam-Vorschau mit Tracking-Anzeige.
- Kalibrierungsmodus mit visuellen Anweisungen.
- Pause, Neustart und Zurück-zum-Menü.
- Einstellungen für Kamera, Steuerung und Sensitivität.

## 4. DESIGN
Professionelles Arcade-Gaming-Design:
- Modern, dynamisch, visuell hochwertig.
- Flüssige Animationen und Partikeleffekte.
- Klare HUDs, Scoreanzeigen und Timer.
- Intuitive Bedienung.
- Gute Lesbarkeit und responsive Layouts.
- Jedes Spiel soll sich wie ein eigenständiges, fertiges Arcade-Spiel anfühlen.

## 5. QUALITÄTSANFORDERUNGEN
- Alle Menüs und Spielmodi müssen tatsächlich funktionieren.
- Keine Platzhalter, Attrappen oder rein dekorativen Buttons.
- Webcam-Tracking muss real implementiert sein.
- Bewegungen müssen zuverlässig in Spielaktionen umgesetzt werden.
- Spielphysik und Kollisionserkennung implementieren.
- Fehlerbehandlung für verweigerte Kamerazugriffe.
- Keine unnötigen Abhängigkeiten.
- Saubere, modulare und wartbare Architektur.
- Spielstände und Statistiken lokal speichern (LocalStorage).

## 6. ENTWICKLUNG
Beginne direkt mit der Implementierung. Priorisiere eine funktionierende Gesamtanwendung.

Vorgehen:
1. Grundstruktur, Menü und Architektur erstellen.
2. Webcam-Tracking implementieren und testen.
3. Alle vier Spielmodi vollständig implementieren.
4. Statistiken, Highscores und Einstellungen ergänzen.
5. Design, Animationen und Performance optimieren.

WICHTIG:
- Keine langen Erklärungen oder theoretischen Konzepte.
- Keine Funktionen nur simulieren, wenn sie real implementierbar sind.
- Bestehenden Code nicht unnötig ersetzen.
- Nach jedem Entwicklungsschritt auf Fehler prüfen.
- Bei technischen Einschränkungen eine funktionierende Alternative implementieren.
- Selbstständig sinnvolle Design- und Gameplay-Entscheidungen treffen.

**ZIEL:** Eine sofort spielbare, hochwertige Webcam-Motion-Gaming-Website mit vier eigenständigen Spielmodi.

# technische Empfehlungen
MediaPipe: Für Hand-, Arm- und Körpertracking. Besonders wichtig für Fruit Slasher und Basketball.

Pose Landmarker: Für die Beinerkennung beim Elfmeterschießen. Hier reicht reines Handtracking nicht.

Modulare Architektur: Jedes Spiel als eigenes Modul entwickeln, damit spätere Spielmodi einfach ergänzt werden können.