// Erzeugt den Wert für ADMIN_PASSWORD_HASH. Aufruf: npm run admin:hash  (Passwort wird verdeckt abgefragt)
// Den ausgegebenen Wert in .env.local und in Vercel (Production) eintragen; das Passwort selbst nie speichern.
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const muted = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
let asking = true;
muted._writeToOutput = (s) => {
  if (!asking) muted.output.write(s);
};
process.stdout.write("Neues Admin-Passwort: ");
const password: string = await new Promise((resolve) => rl.question("", resolve));
asking = false;
rl.close();
if (password.length < 10) {
  console.error("\nBitte mindestens 10 Zeichen verwenden.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`\nADMIN_PASSWORD_HASH=scrypt:${salt.toString("base64")}:${hash.toString("base64")}`);
