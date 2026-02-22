# WordPress-formulieren koppelen aan het platform

Met deze stappen stuur je inzendingen van WordPress-formulieren als kansen naar GrowSocial (zelfde ingest-endpoint als Trustoo/webhooks).

**Optie 1 – Via Zapier (aanbevolen voor JetFormBuilder):** formulier → Zapier Catch Hook → Zapier POST naar GrowSocial. Geen PHP, geen `content_type_not_found`. Zie [Via Zapier](#via-zapier-zoals-trustoo).  
**Optie 2 – Direct:** formulier stuurt zelf naar de webhook-URL (met secret in header). Zie [Stap 3](#stap-3-wordpress--formulier-direct-sturen-zonder-zapier).

---

## Stap 1: Kansenstroom aanmaken in GrowSocial

1. Ga in GrowSocial naar **Sales → Kansenstromen → Nieuwe stroom**.
2. Vul in:
   - **Naam:** bijv. "Website contactformulier"
   - **Type:** **Website Form**
   - **Veldkoppeling:** pas aan op de veldnamen die je WordPress-formulier straks stuurt (zie hieronder).
   - **Secret:** kies een sterk wachtwoord en bewaar het; je hebt het nodig in WordPress.
3. Klik op **Aanmaken**.
4. **Bewaar de Webhook URL en het Secret** (eenmalig zichtbaar).  
   Voorbeeld: `https://app.growsocialmedia.nl/api/ingest/opportunities/<uuid>`.

---

## Stap 2: Welke velden kun je sturen?

De ingest-API verwacht een **JSON-body**. Velden die als kans worden opgeslagen (via mapping):

| Platformveld    | Gebruik in mapping | Voorbeeld JSON-key |
|-----------------|--------------------|----------------------|
| company_name    | Bedrijfsnaam       | `company_name` of `business_name` |
| contact_name    | Naam contactpersoon | `contact_name` of `name` |
| email           | E-mail             | `email` |
| phone           | Telefoon           | `phone` |
| message / notes | Bericht of omschrijving | `message` of `description` |
| address         | Adres              | `address` |
| city            | Plaats             | `city` |
| postcode        | Postcode           | `postcode` |

In de stroom kun je bij **Veldkoppeling** instellen welke payload-velden naar welke platformvelden mappen. Standaard staat o.a.:
- `company_name` → payload.company_name  
- `contact_name` → payload.contact_name  
- `email` → payload.email  
- `phone` → payload.phone  
- `message` → payload.message (komt in description/notes)

Als je WordPress andere namen gebruikt (bijv. `your_name`, `bedrijfsnaam`), zet dan in de veldkoppeling bijv. `payload.your_name` voor contactnaam en `payload.bedrijfsnaam` voor bedrijfsnaam.

---

## Via Zapier (zoals Trustoo)

Je kunt het formulier ook via Zapier naar GrowSocial sturen: WordPress stuurt naar een Zapier-webhook, Zapier stuurt door naar GrowSocial met het secret. Geen PHP nodig, en je vermijdt vaak de `content_type_not_found`-fout omdat het formulier alleen met Zapier praat.

### Zapier – Stap 1: Zap aanmaken, trigger = Catch Hook

1. In Zapier: **Create Zap** (Zap maken).
2. **Trigger:** app **Webhooks by Zapier** → trigger **Catch Hook**.
3. Klik **Continue**, kopieer de **Webhook URL** die Zapier toont (bijv. `https://hooks.zapier.com/hooks/catch/12345/abcdef/`). Die gebruik je straks in JetFormBuilder als “Call Webhook”-URL.
4. Laat deze stap open; je vult de hook later met een test-submit.

### WordPress / JetFormBuilder – formulier naar Zapier sturen

1. In het formulier: **Post Submit Actions** → **Call Webhook**.
2. **Webhook URL:** plak de Zapier Catch Hook-URL uit de vorige stap.
3. Geen secret nodig voor Zapier. Zorg dat de velden die je stuurt herkenbare namen hebben (bijv. `company_name`, `contact_name`, `email`, `phone`, `message`); die kun je in de Zapier-action stap koppelen naar de GrowSocial-body.
4. Sla het formulier op, doe een **testverzending**.
5. Ga terug naar Zapier: klik **Test trigger**. Zapier zou nu de testinzending moeten zien.

### Zapier – Stap 2: Action = POST naar GrowSocial

1. **Action:** app **Webhooks by Zapier** → action **POST**.
2. Vul in:
   - **URL:** de Webhook URL uit GrowSocial (Stap 1), bijv.  
     `https://app.growsocialmedia.nl/api/ingest/opportunities/xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Payload Type:** **JSON**
   - **Data:** koppel de velden uit de trigger (wat Zapier van het formulier kreeg) naar de keys die GrowSocial verwacht, bijv.:
     - `company_name` → (veld uit trigger)
     - `contact_name` → (veld uit trigger)
     - `email` → (veld uit trigger)
     - `phone` → (veld uit trigger)
     - `message` → (veld uit trigger)
   - **Headers:**  
     - **Key:** `X-Stream-Secret`  
     - **Value:** het Secret van de kansenstroom uit GrowSocial
3. **Test** de action; controleer in GrowSocial bij **Sales → Kansen** of er een kans is aangemaakt.
4. Zet de Zap **Aan**.

Klaar: elk formulierinzending gaat naar Zapier en wordt door Zapier naar GrowSocial gestuurd met het juiste secret.

---

## Stap 3: WordPress – formulier direct sturen (zonder Zapier)

Je moet bij *form submit* een **server-side** POST doen naar de webhook-URL (met secret in de header). Dat kan op twee manieren:

### Optie A: Plugin met webhook / “Remote Request”

- **Gravity Forms:** add-on “Webhooks” of “Gravity Forms Webhooks” om bij submit een POST naar een URL te sturen. Stel URL in op de webhook-URL en voeg custom header `X-Stream-Secret: <jouw-secret>` toe; body = JSON met je velden.
- **WPForms:** “Webhooks” add-on (indien beschikbaar) of custom code (zie Optie B).
- **Fluent Forms / Formidable / Contact Form 7:** zoek naar “Webhook”, “HTTP Request” of “Remote POST” en vul webhook-URL + header + body in.

Controleer in de plugin of je **headers** kunt meegeven (voor `X-Stream-Secret`) en of de body als **JSON** wordt gestuurd.

#### JetFormBuilder

**Aanbevolen: Call Hook** (geen `content_type_not_found`-fout). Veel gebruikers krijgen met **Call Webhook** de fout "Error code: content_type_not_found"; met **Call Hook** stuurt WordPress zelf de request en wordt het antwoord niet door de plugin geparsed.

**Stap 1 – In het formulier:** Post Submit Actions → New Action → **Call Hook**. **Hook Name:** bijv. `growsocial_send_opportunity`.

**Stap 2 – In `functions.php`** (vervang URL en secret, pas de array-keys aan op jouw veldnamen):

```php
add_action('jet-form-builder/custom-action/growsocial_send_opportunity', function ($request, $action_handler) {
    $body = [
        'company_name' => $request['company_name'] ?? $request['bedrijfsnaam'] ?? '',
        'contact_name' => $request['contact_name'] ?? $request['naam'] ?? '',
        'email'        => $request['email'] ?? '',
        'phone'        => $request['phone'] ?? $request['telefoon'] ?? '',
        'message'      => $request['message'] ?? $request['bericht'] ?? '',
    ];
    $webhook_url = 'https://app.growsocialmedia.nl/api/ingest/opportunities/JOUW-STREAM-UUID';
    $secret      = 'JOUW-X-STREAM-SECRET';
    wp_remote_post($webhook_url, [
        'headers'  => [
            'Content-Type'    => 'application/json',
            'X-Stream-Secret' => $secret,
        ],
        'body'     => json_encode($body),
        'blocking' => false,
    ]);
}, 10, 2);
```

**Optioneel – Call Webhook:** Als je toch **Call Webhook** wilt gebruiken: Post Submit Actions → **Call Webhook**, vul de Webhook URL in. Voeg in PHP de secret-header toe (anders krijg je 401):

```php
add_filter('jet-form-builder/action/webhook/request-args', function ($args, $action) {
    $webhook_secret = 'JOUW-X-STREAM-SECRET';
    if (empty($args['headers'])) $args['headers'] = [];
    $args['headers']['X-Stream-Secret'] = $webhook_secret;
    $args['headers']['Content-Type']   = 'application/json';
    return $args;
}, 10, 2);
```

Bij sommige hosts/instellingen geeft Call Webhook alsnog "content_type_not_found"; gebruik dan Call Hook.

### Optie B: Eigen code (theme of plugin)

Gebruik de hook die je formulier-plugin na een succesvolle submit aanroept, en stuur daar een POST met `wp_remote_post()`.

**Voorbeeld (PHP) – Contact Form 7**

```php
add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;

    $posted = $submission->get_posted_data();
    // Pas keys aan op jouw CF7 veldnamen
    $body = [
        'company_name' => $posted['bedrijfsnaam'] ?? '',
        'contact_name' => $posted['jouw-naam'] ?? '',
        'email' => $posted['e-mail'] ?? '',
        'phone' => $posted['telefoon'] ?? '',
        'message' => $posted['bericht'] ?? '',
    ];

    $webhook_url = 'https://app.growsocialmedia.nl/api/ingest/opportunities/JOUW-STREAM-UUID';
    $secret = 'JOUW-X-STREAM-SECRET';

    wp_remote_post($webhook_url, [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Stream-Secret' => $secret,
        ],
        'body' => json_encode($body),
        'blocking' => false, // optioneel: niet wachten op antwoord
    ]);
});
```

**Voorbeeld – Gravity Forms (na succesvolle submit)**

```php
add_action('gform_confirmation', function ($form, $entry, $ajax) {
    $body = [
        'company_name' => rgar($entry, '3'),   // ID van veld Bedrijfsnaam
        'contact_name' => rgar($entry, '1'),    // ID van veld Naam
        'email' => rgar($entry, '2'),
        'phone' => rgar($entry, '4'),
        'message' => rgar($entry, '5'),
    ];

    $webhook_url = 'https://app.growsocialmedia.nl/api/ingest/opportunities/JOUW-STREAM-UUID';
    $secret = 'JOUW-X-STREAM-SECRET';

    wp_remote_post($webhook_url, [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Stream-Secret' => $secret,
        ],
        'body' => json_encode($body),
    ]);
}, 10, 3);
```

Vervang `JOUW-STREAM-UUID` en `JOUW-X-STREAM-SECRET` door de waarden uit Stap 1. Bewaar het secret liefst in een config/optie of environment variable, niet hardcoded in de theme.

---

## Stap 4: Testen

1. Vul het WordPress-formulier in en verstuur.
2. Controleer in GrowSocial bij **Sales → Kansen** of er een nieuwe kans is aangemaakt.
3. Bij de stroom (**Kansenstromen → [jouw formulierstroom]**) kun je bij **Event logs** zien of de request succesvol was (200) of een fout gaf.

---

## Troubleshooting

- **"Internal error! Error code: content_type_not_found" (JetFormBuilder):** de fout komt door het **antwoord van WordPress** naar de browser na formulierverzending (niet door GrowSocial). Probeer het volgende:
  1. **Extra snippet** – voeg in `functions.php` **boven** je Call Hook-snippet dit toe, zodat elke REST-response een JSON Content-Type krijgt (JetFormBuilder gebruikt soms de REST API):
     ```php
     add_filter('rest_post_dispatch', function ($response, $server, $request) {
         if ($response instanceof \WP_HTTP_Response) {
             $response->header('Content-Type', 'application/json; charset=' . get_option('blog_charset'));
         }
         return $response;
     }, 10, 3);
     ```
  2. **Blijft de fout bestaan:** gebruik **Zapier** (zie [Via Zapier](#via-zapier-zoals-trustoo)): formulier → Call Webhook naar **Zapier Catch Hook-URL** → Zapier stuurt door naar GrowSocial. Dan is het antwoord dat het formulier ziet van Zapier, niet van WordPress.
- **401 / Invalid X-Stream-Secret:** header `X-Stream-Secret` moet exact overeenkomen met het secret van de stroom (geen spaties).
- **400 / Payload must map to...:** er is geen geldige mapping voor title, company_name of contact. Stuur minimaal één van: bedrijfsnaam, contactnaam of e-mail, en controleer de veldkoppeling in de stroom.
- **Geen kans zichtbaar:** kijk in de Event logs van de stroom naar de foutmelding en de ontvangen payload; pas veldkoppeling of JSON-keys daarop aan.
