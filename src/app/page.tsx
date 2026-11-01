import Image from "next/image";
import Link from "next/link";
import { MenuImage } from "@/components/menu-image";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { business, pickupLocation, pilot, taxNote } from "@/config/business";
import { allergens, menus, orderRules, sides } from "@/config/menu";
import { paymentMethodsText } from "@/config/payments";
import { deliveryArea, schedule } from "@/config/schedule";
import { formatEuro } from "@/lib/format";

const weekdayNames = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const deliveryDays = schedule.deliveryWeekdays.map((d) => weekdayNames[d]).join(" · ");
const deliveryHours = `${schedule.windows[0].start}–${schedule.windows.at(-1)!.end}`;
const featured = menus.find((m) => m.id === "crunch-combo")!;
const badges: Partial<Record<(typeof menus)[number]["id"], string>> = {
  "crunch-combo": "Lean's Tipp",
  "family-pack": "Zum Teilen",
};
const price = (cents: number) => formatEuro(cents).replace(",00", "");

const pains = [
  {
    title: "Ewig warten",
    text: "Bestellt um zwölf, gegessen um eins. Und die Pause ist dann auch schon vorbei.",
  },
  {
    title: "Gebühren obendrauf",
    text: "Liefergebühr, Servicegebühr, Kleinbestellzuschlag – am Ende zahlst du fast das Doppelte.",
  },
  {
    title: "Lauwarm & pappig",
    text: "Durch die halbe Stadt gefahren, im Styropor gedämpft. Crispy ist da nichts mehr.",
  },
];

const reasons = [
  {
    title: "Cornflakes-Crunch",
    text: "Unsere eigene Cornflakes-Panade. Knackt beim ersten Biss und bleibt crispy, weil der Weg zu dir kurz ist.",
  },
  {
    title: "Himalaya-Salz",
    text: "Kein billiges Industriesalz. Wir würzen mit echtem Himalaya-Salz.",
  },
  {
    title: "Bio-Sonnenblumenöl",
    text: "Kein Rapsöl. Wir frittieren ausschließlich in Bio-Sonnenblumenöl.",
  },
  {
    title: "Signature Sauce",
    text: "Cremig, würzig, legendär: Lean's Worcestershire Sauce ist in jedem Menü schon dabei.",
  },
  {
    title: "Frisch pro Zeitfenster",
    text: "Wir braten für dein Lieferfenster, nicht auf Vorrat. Deshalb ist die Menge pro Fenster begrenzt.",
  },
  {
    title: "Kurze Wege",
    text: "Wir liefern nur auf FRANKLIN. Vom Herd zu dir sind es Minuten, nicht eine halbe Stunde.",
  },
  {
    title: "0 € Liefergebühr",
    text: `Ab ${formatEuro(orderRules.minOrderCents)} Bestellwert. Kein Aufschlag, keine Servicegebühr, keine Überraschung.`,
  },
  {
    title: "Aus FRANKLIN. Für FRANKLIN.",
    text: "Kein Konzern, keine Plattform. Ein Familienprojekt aus dem Quartier – dein Geld bleibt hier.",
  },
];

const useCases = [
  {
    title: "Mittagspause im Büro",
    text: "Bis 60 Minuten vorher bestellen, pünktlich zur Pause an der Tür. Die Crunch Combo macht satt, ohne dich lahmzulegen.",
    pick: "crunch-combo",
  },
  {
    title: "Lunch fürs ganze Team",
    text: "Sammelt die Bestellung, einer zahlt, alles kommt zusammen. Family Pack oder Big Boy Box zum Teilen.",
    pick: "family-pack",
  },
  {
    title: "Zu Hause auf FRANKLIN",
    text: "Homeoffice, Kinder kommen aus der Schule, keine Lust zu kochen? Wir bringen's vorbei.",
    pick: "big-boy-box",
  },
] as const;

export default function Home() {
  return (
    <main className="home">
      {/* 1 · Hero */}
      <section className="wrap hero">
        <div>
          <p className="eyebrow">
            {pilot.label} · Start am {pilot.startLabel} · Testlauf bis {pilot.endLabel}
          </p>
          <h1>
            Crispy Chicken.
            <br />
            <span className="brush">Frisch</span> geliefert.
          </h1>
          <p className="lead">
            Knusprige Chicken Strips in Cornflakes-Panade, goldene Pommes und Lean&apos;s Signature
            Sauce. Vorbestellen, online bezahlen – wir bringen dir dein Mittagessen frisch, direkt
            ins Büro oder nach Hause.
          </p>
          <div className="hero-facts">
            <span className="chip">
              Start <b>{pilot.startLabel}</b>
            </span>
            <span className="chip">
              <b>{deliveryDays}</b> {deliveryHours} Uhr
            </span>
            <span className="chip">
              <b>0 €</b> Liefergebühr
            </span>
            <span className="chip">
              Mindestbestellwert <b>{formatEuro(orderRules.minOrderCents)}</b>
            </span>
            <span className="chip">
              Auch <b>zum Abholen</b>
            </span>
          </div>
          <div className="hero-actions">
            <Link href="/bestellen" className="btn btn-red">
              Jetzt vorbestellen →
            </Link>
            <WhatsAppButton />
          </div>
          <p className="trust-line">
            <span>★</span> Auf dem LOOPFEST ausverkauft · Familienprojekt aus FRANKLIN
          </p>
        </div>
        <div className="hero-photo hero-photo-food">
          <Image
            src={featured.image}
            alt={`${featured.name}: ${featured.description}`}
            width={1448}
            height={1086}
            priority
            sizes="(min-width: 860px) 520px, 92vw"
          />
        </div>
      </section>

      <div className="band">
        <div className="wrap band-inner">
          <div className="band-item">
            <strong>{deliveryDays}</strong>
            <span>Liefertage</span>
          </div>
          <div className="band-item">
            <strong>{deliveryHours}</strong>
            <span>Mittags, im 30-Minuten-Fenster</span>
          </div>
          <div className="band-item">
            <strong>Ganz FRANKLIN</strong>
            <span>PLZ {deliveryArea.postalCodes.join(", ")}</span>
          </div>
          <div className="band-item">
            <strong>0 € Liefergebühr</strong>
            <span>Ab {formatEuro(orderRules.minOrderCents)} Bestellwert</span>
          </div>
        </div>
      </div>

      {/* 1b · Testlauf */}
      <section id="testlauf" className="wrap section pilot">
        <div>
          <p className="eyebrow">{pilot.label} · Testlauf</p>
          <h2>Warum nur drei Tage die Woche?</h2>
          <p className="lead">
            Nach dem ausverkauften Stand auf dem LOOPFEST testen wir vom {pilot.startLabel} bis zum {pilot.endLabel}, ob FRANKLIN Lust auf
            Lean&apos;s hat. Deshalb liefern wir erst mal nur montags, mittwochs und donnerstags mittags und braten
            jede Portion frisch für dein Zeitfenster. Läuft&apos;s, kommen mehr Tage dazu. Welche, entscheidest du mit.
          </p>
        </div>
        <div className="pilot-cta">
          <strong>Wann hättest du gern Lean&apos;s?</strong>
          <span>4 kurze Fragen, 30 Sekunden, anonym.</span>
          <Link href={pilot.surveyPath} className="btn btn-red">
            Zur Umfrage →
          </Link>
        </div>
      </section>

      {/* 2 · Problem */}
      <section className="wrap section">
        <p className="eyebrow">Mittagspause auf FRANKLIN</p>
        <h2>
          Schluss mit <span className="brush">lauwarm</span> und teuer.
        </h2>
        <p className="lead section-lead">
          Du kennst das: Hunger um halb zwölf, die App zeigt 45 Minuten, und was ankommt, hat mit
          crispy nicht mehr viel zu tun.
        </p>
        <div className="pain-grid">
          {pains.map((p) => (
            <div className="pain" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <p className="turn">
          Bei Lean&apos;s ist das anders. <span>Und zwar so:</span>
        </p>
      </section>

      {/* 3 · Lösung / USPs */}
      <section className="wrap section section-tight">
        <p className="eyebrow">Warum Lean&apos;s</p>
        <h2>Acht Gründe, warum du nicht mehr wechselst</h2>
        <div className="reason-grid">
          {reasons.map((r, i) => (
            <div className="reason" key={r.title}>
              <span className="reason-no">{String(i + 1).padStart(2, "0")}</span>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · Angebot */}
      <section className="wrap section section-tight" id="menue">
        <p className="eyebrow">Unser Menü</p>
        <h2>
          Frisch. Heiß. <span className="brush">Unschlagbar.</span>
        </h2>
        <p className="lead section-lead">
          Vier Menüs, alle mit Signature Sauce. Gewürzt mit Himalaya-Salz, frittiert in Bio-Sonnenblumenöl. Kein
          Schnickschnack – nur Chicken, das knackt.
        </p>
        <div className="menu-list">
          {menus.map((item) => (
            <div className="menu-card" key={item.id}>
              <div className="menu-card-media">
                <MenuImage
                  src={item.image}
                  alt={`${item.name}: ${item.description}`}
                  sizes="(min-width: 760px) 560px, 92vw"
                />
                {badges[item.id] && <span className="menu-badge">{badges[item.id]}</span>}
              </div>
              <div className="menu-card-body">
                <div>
                  <h3>
                    <span className="menu-no">{item.number}</span> {item.name}
                  </h3>
                  <p className="menu-desc">{item.description}</p>
                  <p className="hint">{item.includes}</p>
                </div>
                <div className="menu-card-foot">
                  <strong className="menu-price">{formatEuro(item.priceCents)}</strong>
                  <Link href="/bestellen" className="btn btn-red">
                    Bestellen
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="side-list">
          <h3>Side Orders</h3>
          {sides.map((item) => (
            <div className="side-line" key={item.id}>
              <span>{item.name}</span>
              <span>{formatEuro(item.priceCents)}</span>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 14 }}>
            Mindestbestellwert {formatEuro(orderRules.minOrderCents)} · {taxNote}
          </p>
        </div>
      </section>

      {/* 5 · Social Proof */}
      <section className="proof">
        <div className="wrap section">
          <p className="eyebrow">Getestet. Für gut befunden.</p>
          <h2>
            Auf dem LOOPFEST <span className="brush">ausverkauft.</span>
          </h2>
          <p className="lead section-lead">
            Unser erster Stand auf FRANKLIN war am Ende komplett ausverkauft. Genau dieses Chicken
            bringen wir dir jetzt nach Hause.
          </p>
          <div className="proof-grid">
            <figure className="polaroid">
              <Image
                src="/assets/photos/approved-community.webp"
                alt="Gäste am Lean's-Stand auf dem LOOPFEST"
                width={1536}
                height={2048}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>Gäste am Stand</figcaption>
            </figure>
            <figure className="polaroid tilt-right">
              <Image
                src="/assets/photos/approved-team.webp"
                alt="Lean bereitet am Stand Chicken Strips zu"
                width={1800}
                height={3197}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>Frisch gebraten, Strip für Strip</figcaption>
            </figure>
            <figure className="polaroid">
              <Image
                src="/assets/photos/approved-stand.webp"
                alt="Der Lean's-Stand auf dem LOOPFEST"
                width={810}
                height={1152}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>LOOPFEST · FRANKLIN</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 6 · Für wen */}
      <section className="wrap section">
        <p className="eyebrow">Für wen?</p>
        <h2>Für jeden Hunger das passende Menü</h2>
        <div className="usecase-grid">
          {useCases.map((u) => {
            const item = menus.find((m) => m.id === u.pick)!;
            return (
              <div className="usecase" key={u.title}>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
                <Link href="/bestellen" className="usecase-pick">
                  Empfehlung: {item.name} · {formatEuro(item.priceCents)} →
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7 · Ablauf */}
      <section className="wrap section section-tight" id="so-gehts">
        <p className="eyebrow">So geht&apos;s</p>
        <h2>In drei Schritten zum Mittagessen</h2>
        <div className="steps">
          <div className="step">
            <h3>Bestellen</h3>
            <p>Menü und Side Orders wählen, Liefertag und 30-Minuten-Fenster aussuchen.</p>
          </div>
          <div className="step">
            <h3>Bezahlen</h3>
            <p>Sicher online mit {paymentMethodsText}. Kein Kundenkonto, kein Passwort.</p>
          </div>
          <div className="step">
            <h3>Genießen</h3>
            <p>Wir braten frisch und bringen&apos;s in deinem Zeitfenster.</p>
          </div>
        </div>
      </section>

      {/* 8 · Risiko raus */}
      <section className="wrap section section-tight">
        <div className="promise">
          <div>
            <p className="eyebrow">Unser Versprechen</p>
            <h2>Kein Risiko für dich.</h2>
          </div>
          <ul className="promise-list">
            <li>
              <strong>Geld zurück, wenn wir nicht liefern können.</strong> Komplett, ohne Diskussion.
            </li>
            <li>
              <strong>Sichere Zahlung über Stripe.</strong> Wir sehen und speichern keine Kartendaten.
            </li>
            <li>
              <strong>Persönlicher Kontakt.</strong> Fragen oder Änderungen? Ein kurzer WhatsApp an
              Lean genügt.
            </li>
            <li>
              <strong>Kein Abo, kein Konto.</strong> Du bestellst, wann du willst.
            </li>
          </ul>
        </div>
      </section>

      {/* 9 · Story */}
      <section className="wrap section story">
        <figure className="polaroid">
          <Image
            src="/assets/photos/approved-lean.webp"
            alt="Lean steht neben dem Lean's-Raising-Canes-Chicken-Aufsteller"
            width={1800}
            height={3197}
            sizes="340px"
          />
          <figcaption>Lean · FRANKLIN</figcaption>
        </figure>
        <div>
          <p className="eyebrow">Aus FRANKLIN. Für FRANKLIN.</p>
          <h2>Ein Junge, ein Rezept, ein Quartier.</h2>
          <p className="lead">
            {business.name} ist Leans Projekt – mit der ganzen Familie im Rücken. Die Idee: das
            Chicken, das wir selbst am liebsten essen, so frisch wie möglich zu den Nachbarn bringen.
          </p>
          <p className="lead">
            Jetzt testen wir die Lieferung, bis zum {pilot.endLabel}. Jede Bestellung und jede Stimme in
            der <Link href={pilot.surveyPath}>Umfrage</Link> hilft uns, daraus etwas Festes auf FRANKLIN zu
            machen.
          </p>
        </div>
      </section>

      {/* 10 · Knappheit + CTA */}
      <section className="final-cta">
        <div className="wrap">
          <p className="eyebrow light">Begrenzte Menge pro Zeitfenster</p>
          <h2>Dein Lunch-Slot wartet.</h2>
          <p className="lead">
            Wir braten pro 30-Minuten-Fenster nur so viel, wie wir frisch schaffen. Wenn ein Fenster
            voll ist, ist es voll. Bestellschluss jeweils {schedule.orderLeadMinutes} Minuten vorher.
          </p>
          <div className="hero-actions">
            <Link href="/bestellen" className="btn btn-light">
              Jetzt Zeitfenster sichern →
            </Link>
            <WhatsAppButton />
          </div>
        </div>
      </section>

      {/* 11 · Einwände */}
      <section className="wrap section" id="fragen">
        <p className="eyebrow">Fragen</p>
        <h2>Gut zu wissen</h2>
        <div className="faq">
          <details>
            <summary>Wohin liefert ihr?</summary>
            <p>
              Auf ganz {deliveryArea.label} (PLZ {deliveryArea.postalCodes.join(", ")}). Gib einfach
              deine Adresse und, wenn nötig, Firma, Etage oder Klingel an.
            </p>
          </details>
          <details>
            <summary>Kann ich auch abholen?</summary>
            <p>
              Ja. Wähl beim Bestellen „Abholung“ und hol dein Chicken in deinem Zeitfenster in der{" "}
              {pickupLocation.street}, {pickupLocation.city} ab. Bei Abholung gibt es keinen
              Mindestbestellwert, und wir schicken dir eine Mail, sobald alles bereitliegt.
            </p>
          </details>
          <details>
            <summary>Wann liefert ihr und bis wann kann ich bestellen?</summary>
            <p>
              Los geht&apos;s am {pilot.startLabel}, dann {deliveryDays} zwischen {deliveryHours} Uhr in
              30-Minuten-Fenstern. Vorbestellen kannst du schon jetzt. Bestellen kannst du
              bis {schedule.orderLeadMinutes} Minuten vor Beginn deines Fensters und bis zu{" "}
              {schedule.daysAhead} Tage im Voraus.
            </p>
          </details>
          <details>
            <summary>Was kostet die Lieferung?</summary>
            <p>
              Nichts. Ab {formatEuro(orderRules.minOrderCents)} Bestellwert liefern wir ohne
              Liefergebühr. {taxNote}
            </p>
          </details>
          <details>
            <summary>Wie kann ich bezahlen?</summary>
            <p>
              Online über Stripe mit {paymentMethodsText}. Deine Sparkassen- oder Bankkarte
              funktioniert, wenn sie ein Visa- oder Mastercard-Logo hat; sonst wähl einfach
              SEPA-Lastschrift mit deiner IBAN. Bestellst du über WhatsApp, schicken wir dir einen
              persönlichen Bezahllink.
            </p>
          </details>
          <details>
            <summary>Kann ich fürs ganze Team bestellen?</summary>
            <p>
              Klar. Pack einfach mehrere Menüs in eine Bestellung – bis zu{" "}
              {orderRules.maxQuantityPerItem} pro Menü. Für größere Mengen schreib uns vorher auf
              WhatsApp, dann planen wir die Fritteuse für dich ein.
            </p>
          </details>
          <details>
            <summary>Macht ihr auch Events?</summary>
            <p>Ja, Lean&apos;s ist für Feste, Firmenevents und private Feiern buchbar. Schreib uns auf WhatsApp.</p>
          </details>
          <details>
            <summary>Ich muss meine Bestellung ändern.</summary>
            <p>Schreib uns kurz auf WhatsApp mit deiner Bestellnummer – wir kümmern uns.</p>
          </details>
          <details>
            <summary>Allergene</summary>
            <ul>
              {allergens.entries.map((a) => (
                <li key={a.name}>
                  {a.name}: {a.list.join(", ")}
                </li>
              ))}
            </ul>
            <p>Spuren anderer Allergene können wir in unserer Küche nicht ausschließen.</p>
          </details>
        </div>
        <div className="hero-actions">
          <Link href="/bestellen" className="btn btn-red">
            Jetzt vorbestellen →
          </Link>
          <WhatsAppButton />
        </div>
      </section>

      {/* Mobile: dauerhafte Bestell-Leiste */}
      <div className="home-cta-bar">
        <div className="wrap summary-inner">
          <div className="summary-total">
            <strong>
              {featured.name} {price(featured.priceCents)}
            </strong>
            <span>0 € Liefergebühr · {deliveryDays}</span>
          </div>
          <Link href="/bestellen" className="btn btn-red">
            Bestellen →
          </Link>
        </div>
      </div>
    </main>
  );
}
