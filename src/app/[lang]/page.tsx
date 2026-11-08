import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CallButton } from "@/components/call-button";
import { DrinkCard } from "@/components/drink-card";
import { MenuImage } from "@/components/menu-image";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { business, phoneHref, pickupLocation, pilot, pilotDates, taxNoteFor } from "@/config/business";
import { allergens, drinks, drinksEnabled, itemText, menus, orderRules, sides, type CatalogItem } from "@/config/menu";
import { paymentMethodsTextFor } from "@/config/payments";
import { deliveryArea, schedule } from "@/config/schedule";
import { getDictionary, localePath, resolveLocale, type Locale } from "@/i18n";
import { formatEuro, formatEuroShort } from "@/lib/format";
import { loadOrderDeps } from "@/server/integrations";

const deliveryHours = `${schedule.windows[0].start}–${schedule.windows.at(-1)!.end}`;
const featured = menus.find((m) => m.id === "crunch-combo")!;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = await resolveLocale(params);
  const dict = getDictionary(lang);
  const t = dict.home;
  const dates = pilotDates(lang);
  const euro = (cents: number) => formatEuro(cents, lang);
  const href = (path: string) => localePath(lang, path);
  const taxNote = taxNoteFor(lang);
  const paymentMethods = paymentMethodsTextFor(lang);
  const minOrder = euro(orderRules.minOrderCents);
  const deliveryDays = schedule.deliveryWeekdays.map((d) => t.weekdays[d]).join(" · ");
  const featuredText = itemText(featured, lang);
  const actions = (
    <>
      <WhatsAppButton lang={lang} />
      <CallButton lang={lang} />
    </>
  );

  return (
    <main className="home">
      {/* 1 · Hero */}
      <section className="wrap hero">
        <div>
          <p className="eyebrow">{t.hero.eyebrow(pilot.label, dates.startLabel, dates.endLabel)}</p>
          <h1>
            {t.hero.titleLine1}
            <br />
            <span className="brush">{t.hero.titleBrush}</span>
            {t.hero.titleRest}
          </h1>
          <p className="lead">{t.hero.lead}</p>
          <div className="hero-facts">
            <span className="chip">
              {t.hero.chipStart} <b>{dates.startLabel}</b>
            </span>
            <span className="chip">
              <b>{deliveryDays}</b> {deliveryHours}
              {t.hoursSuffix}
            </span>
            <span className="chip">
              <b>{t.hero.chipFreeAmount}</b> {t.hero.chipFreeDelivery}
            </span>
            <span className="chip">
              {t.hero.chipMinOrder} <b>{minOrder}</b>
            </span>
            <span className="chip">
              {t.hero.chipPickupBefore} <b>{t.hero.chipPickup}</b>
            </span>
          </div>
          <div className="hero-actions">
            <Link href={href("/bestellen")} className="btn btn-red">
              {t.hero.cta}
            </Link>
            {actions}
          </div>
          <p className="trust-line">
            <span>★</span> {t.hero.trust}
          </p>
        </div>
        <div className="hero-photo hero-photo-food">
          <Image
            src={featured.image}
            alt={`${featuredText.name}: ${featuredText.description}`}
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
            <span>{t.band.days}</span>
          </div>
          <div className="band-item">
            <strong>{deliveryHours}</strong>
            <span>{t.band.window}</span>
          </div>
          <div className="band-item">
            <strong>{t.band.area}</strong>
            <span>
              {t.band.postalCode} {deliveryArea.postalCodes.join(", ")}
            </span>
          </div>
          <div className="band-item">
            <strong>{t.band.freeDelivery}</strong>
            <span>{t.band.fromMinOrder(minOrder)}</span>
          </div>
        </div>
      </div>

      {/* 1b · Testlauf */}
      <section id="testlauf" className="wrap section pilot">
        <div>
          <p className="eyebrow">{t.pilot.eyebrow(pilot.label)}</p>
          <h2>{t.pilot.title}</h2>
          <p className="lead">{t.pilot.lead(dates.startLabel, dates.endLabel)}</p>
        </div>
        <div className="pilot-cta">
          <strong>{t.pilot.ctaTitle}</strong>
          <span>{t.pilot.ctaText}</span>
          <Link href={href(pilot.surveyPath)} className="btn btn-red">
            {t.pilot.ctaButton}
          </Link>
        </div>
      </section>

      {/* 2 · Problem */}
      <section className="wrap section">
        <p className="eyebrow">{t.problem.eyebrow}</p>
        <h2>
          {t.problem.titleBefore}
          <span className="brush">{t.problem.titleBrush}</span>
          {t.problem.titleAfter}
        </h2>
        <p className="lead section-lead">{t.problem.lead}</p>
        <div className="pain-grid">
          {t.pains.map((p) => (
            <div className="pain" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <p className="turn">
          {t.problem.turn} <span>{t.problem.turnSpan}</span>
        </p>
      </section>

      {/* 3 · Lösung / USPs */}
      <section className="wrap section section-tight">
        <p className="eyebrow">{t.why.eyebrow}</p>
        <h2>{t.why.title}</h2>
        <div className="reason-grid">
          {t.reasons(minOrder).map((r, i) => (
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
        <p className="eyebrow">{t.menu.eyebrow}</p>
        <h2>
          {t.menu.titleBefore}
          <span className="brush">{t.menu.titleBrush}</span>
        </h2>
        <p className="lead section-lead">{t.menu.lead}</p>
        <div className="menu-list">
          {menus.map((item) => {
            const text = itemText(item, lang);
            return (
              <div className="menu-card" key={item.id}>
                <div className="menu-card-media">
                  <MenuImage
                    src={item.image}
                    alt={`${text.name}: ${text.description}`}
                    sizes="(min-width: 760px) 560px, 92vw"
                    labels={dict.menuImage}
                  />
                  {t.badges[item.id] && <span className="menu-badge">{t.badges[item.id]}</span>}
                </div>
                <div className="menu-card-body">
                  <div>
                    <h3>
                      <span className="menu-no">{item.number}</span> {text.name}
                    </h3>
                    <p className="menu-desc">{text.description}</p>
                    <p className="hint">{text.includes}</p>
                  </div>
                  <div className="menu-card-foot">
                    <strong className="menu-price">{euro(item.priceCents)}</strong>
                    <Link href={href("/bestellen")} className="btn btn-red">
                      {t.menu.order}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="side-list">
          <h3>{t.menu.sides}</h3>
          {sides.map((item) => (
            <div className="side-line" key={item.id}>
              <span>{itemText(item, lang).name}</span>
              <span>{euro(item.priceCents)}</span>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 14 }}>
            {t.menu.minOrder(minOrder)} · {taxNote}
          </p>
        </div>
        {drinksEnabled() && (
          <div className="drinks-block">
            <p className="eyebrow">{t.menu.drinksEyebrow}</p>
            <h3 className="drinks-title">{t.menu.drinksTitle}</h3>
            <div className="drink-grid">
              {drinks.map((item) => (
                <Suspense key={item.id} fallback={<HomeDrink item={item} soldOut={false} lang={lang} />}>
                  <LiveHomeDrink item={item} lang={lang} />
                </Suspense>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 14 }}>
              {t.menu.drinksHint}
            </p>
          </div>
        )}
      </section>

      {/* 5 · Social Proof */}
      <section className="proof">
        <div className="wrap section">
          <p className="eyebrow">{t.proof.eyebrow}</p>
          <h2>
            {t.proof.titleBefore}
            <span className="brush">{t.proof.titleBrush}</span>
          </h2>
          <p className="lead section-lead">{t.proof.lead}</p>
          <div className="proof-grid">
            <figure className="polaroid">
              <Image
                src="/assets/photos/approved-community.webp"
                alt={t.proof.communityAlt}
                width={1536}
                height={2048}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>{t.proof.communityCaption}</figcaption>
            </figure>
            <figure className="polaroid tilt-right">
              <Image
                src="/assets/photos/approved-team.webp"
                alt={t.proof.teamAlt}
                width={1800}
                height={3197}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>{t.proof.teamCaption}</figcaption>
            </figure>
            <figure className="polaroid">
              <Image
                src="/assets/photos/approved-stand.webp"
                alt={t.proof.standAlt}
                width={810}
                height={1152}
                sizes="(min-width: 860px) 340px, 80vw"
              />
              <figcaption>{t.proof.standCaption}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 6 · Für wen */}
      <section className="wrap section">
        <p className="eyebrow">{t.audience.eyebrow}</p>
        <h2>{t.audience.title}</h2>
        <div className="usecase-grid">
          {t.useCases.map((u) => {
            const item = menus.find((m) => m.id === u.pick)!;
            return (
              <div className="usecase" key={u.title}>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
                <Link href={href("/bestellen")} className="usecase-pick">
                  {t.audience.pick(itemText(item, lang).name, euro(item.priceCents))}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7 · Ablauf */}
      <section className="wrap section section-tight" id="so-gehts">
        <p className="eyebrow">{t.steps.eyebrow}</p>
        <h2>{t.steps.title}</h2>
        <div className="steps">
          <div className="step">
            <h3>{t.steps.orderTitle}</h3>
            <p>{t.steps.orderText}</p>
          </div>
          <div className="step">
            <h3>{t.steps.payTitle}</h3>
            <p>{t.steps.payText(paymentMethods)}</p>
          </div>
          <div className="step">
            <h3>{t.steps.enjoyTitle}</h3>
            <p>{t.steps.enjoyText}</p>
          </div>
        </div>
      </section>

      {/* 8 · Risiko raus */}
      <section className="wrap section section-tight">
        <div className="promise">
          <div>
            <p className="eyebrow">{t.promise.eyebrow}</p>
            <h2>{t.promise.title}</h2>
          </div>
          <ul className="promise-list">
            {t.promise.items.map((p) => (
              <li key={p.strong}>
                <strong>{p.strong}</strong> {p.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 9 · Story */}
      <section className="wrap section story">
        <figure className="polaroid">
          <Image
            src="/assets/photos/approved-lean.webp"
            alt={t.story.imageAlt}
            width={1800}
            height={3197}
            sizes="340px"
          />
          <figcaption>{t.story.caption}</figcaption>
        </figure>
        <div>
          <p className="eyebrow">{t.story.eyebrow}</p>
          <h2>{t.story.title}</h2>
          <p className="lead">{t.story.lead1(business.name)}</p>
          <p className="lead">
            {t.story.lead2Before(dates.endLabel)}
            <Link href={href(pilot.surveyPath)}>{t.story.lead2Link}</Link>
            {t.story.lead2After}
          </p>
        </div>
      </section>

      {/* 10 · Knappheit + CTA */}
      <section className="final-cta">
        <div className="wrap">
          <p className="eyebrow light">{t.finalCta.eyebrow}</p>
          <h2>{t.finalCta.title}</h2>
          <p className="lead">{t.finalCta.lead(schedule.orderLeadMinutes)}</p>
          <div className="hero-actions">
            <Link href={href("/bestellen")} className="btn btn-light">
              {t.finalCta.button}
            </Link>
            {actions}
          </div>
        </div>
      </section>

      {/* 11 · Einwände */}
      <section className="wrap section" id="fragen">
        <p className="eyebrow">{t.faq.eyebrow}</p>
        <h2>{t.faq.title}</h2>
        <div className="faq">
          <details>
            <summary>{t.faq.whereQ}</summary>
            <p>{t.faq.whereA(deliveryArea.label, deliveryArea.postalCodes.join(", "))}</p>
          </details>
          <details>
            <summary>{t.faq.pickupQ}</summary>
            <p>{t.faq.pickupA(pickupLocation.street, pickupLocation.city)}</p>
          </details>
          <details>
            <summary>{t.faq.whenQ}</summary>
            <p>
              {t.faq.whenA(dates.startLabel, deliveryDays, deliveryHours, schedule.orderLeadMinutes, schedule.daysAhead)}
            </p>
          </details>
          <details>
            <summary>{t.faq.costQ}</summary>
            <p>{t.faq.costA(minOrder, taxNote)}</p>
          </details>
          <details>
            <summary>{t.faq.phoneQ}</summary>
            <p>
              {t.faq.phoneABefore}
              <a href={phoneHref}>{business.operator.phoneDisplay}</a>
              {t.faq.phoneAAfter}
            </p>
          </details>
          <details>
            <summary>{t.faq.payQ}</summary>
            <p>{t.faq.payA(paymentMethods)}</p>
          </details>
          <details>
            <summary>{t.faq.teamQ}</summary>
            <p>{t.faq.teamA(orderRules.maxQuantityPerItem)}</p>
          </details>
          <details>
            <summary>{t.faq.eventsQ}</summary>
            <p>{t.faq.eventsA}</p>
          </details>
          <details>
            <summary>{t.faq.changeQ}</summary>
            <p>
              {t.faq.changeABefore}
              <a href={phoneHref}>{business.operator.phoneDisplay}</a>
              {t.faq.changeAAfter}
            </p>
          </details>
          <details>
            <summary>{t.faq.allergensQ}</summary>
            <ul>
              {allergens.entries.map((a) => {
                const entry = lang === "en" ? a.en : a;
                return (
                  <li key={a.name}>
                    {entry.name}: {entry.list.join(", ")}
                  </li>
                );
              })}
            </ul>
            <p>{t.faq.allergensTraces}</p>
          </details>
        </div>
        <div className="hero-actions">
          <Link href={href("/bestellen")} className="btn btn-red">
            {t.hero.cta}
          </Link>
          {actions}
        </div>
      </section>

      {/* Mobile: dauerhafte Bestell-Leiste */}
      <div className="home-cta-bar">
        <div className="wrap summary-inner">
          <div className="summary-total">
            <strong>
              {featuredText.name} {formatEuroShort(featured.priceCents, lang)}
            </strong>
            <span>{t.ctaBar.freeDelivery(deliveryDays)}</span>
          </div>
          <Link href={href("/bestellen")} className="btn btn-red">
            {t.ctaBar.button}
          </Link>
        </div>
      </div>
    </main>
  );
}

function HomeDrink({ item, soldOut, lang }: { item: CatalogItem; soldOut: boolean; lang: Locale }) {
  const t = getDictionary(lang).drinkCard;
  return (
    <DrinkCard item={item} soldOut={soldOut} lang={lang} labels={t}>
      {!soldOut && (
        <Link href={localePath(lang, `/bestellen?add=${item.id}#drinks`)} className="btn btn-red drink-add">
          {t.addToCart}
        </Link>
      )}
    </DrinkCard>
  );
}

/** Bestand ändert sich mit jeder Bestellung, deshalb pro Anfrage statt im statischen Teil der Seite. */
async function LiveHomeDrink({ item, lang }: { item: CatalogItem; lang: Locale }) {
  await connection();
  const stock = await loadOrderDeps()?.store.drinkStock().catch(() => null);
  const remaining = stock?.find((s) => s.itemId === item.id)?.remaining;
  return <HomeDrink item={item} soldOut={remaining !== undefined && remaining <= 0} lang={lang} />;
}
