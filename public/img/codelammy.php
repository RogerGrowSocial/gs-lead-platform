/**
 * Lammy Yarns — Mega Menu (Collectie + Aanbiedingen)
 * - Shortcodes with caching
 * - Auto cache flush on product/cat changes
 * - Front-end injector so menus appear even when header can't run PHP
 * - FIX: Collectie max 4 kolommen, Aanbiedingen max 6 kolommen
 * - FIX: Geen dubbele injecties via MutationObserver
 * - NEW: Categorieën met ≥1 product met tag "nieuw" staan bovenaan + "Nieuw" badge
 */

/* ---------- Cache Versioning (DEFINITIEVE FIX) ---------- */
if ( ! function_exists('lammy_megamenu_cache_version') ) {
    function lammy_megamenu_cache_version() : string {
        $v = get_option('lammy_megamenu_cache_v', '');
        if ( $v === '' ) {
            $v = (string) time();
            update_option('lammy_megamenu_cache_v', $v, false);
        }
        return $v;
    }
}

if ( ! function_exists('lammy_megamenu_bump_cache_version') ) {
    function lammy_megamenu_bump_cache_version() : void {
        update_option('lammy_megamenu_cache_v', (string) time(), false);
    }
}

// Automatische cache refresh - verhoog dit nummer wanneer je cache wilt verversen
add_action('init', function() {
    $code_version = '5'; // Verhoogd voor sorting fix: Nieuw eerst, uitgelicht op originele plek
    $saved_version = get_option('lammy_megamenu_code_version', '0');
    if ( $code_version !== $saved_version ) {
        lammy_megamenu_bump_cache_version();
        update_option('lammy_megamenu_code_version', $code_version, false);
    }
}, 1);

/* ---------- Helpers ---------- */
if ( ! function_exists( 'lammy_safe_term_link_by_slug' ) ) {
    function lammy_safe_term_link_by_slug( $slug, $taxonomy = 'product_cat' ) {
        if ( empty( $slug ) ) return null;
        $term = get_term_by( 'slug', $slug, $taxonomy );
        if ( ! $term || is_wp_error( $term ) ) return null;
        $url = get_term_link( $term, $taxonomy );
        return is_wp_error( $url ) ? null : $url;
    }
}

/**
 * NEW: Snel checken of een product_cat ≥1 product met tag "nieuw" bevat.
 * Per-request statische cache om queries te minimaliseren.
 */
if ( ! function_exists( 'lammy_term_has_new_product' ) ) {
    function lammy_term_has_new_product( $term_id ) {
        static $cache = [];
        $term_id = (int) $term_id;
        if ( isset( $cache[ $term_id ] ) ) return $cache[ $term_id ];

        $q = new WP_Query( [
            'post_type'      => 'product',
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'tax_query'      => [
                'relation' => 'AND',
                [
                    'taxonomy'         => 'product_cat',
                    'field'            => 'term_id',
                    'terms'            => [ $term_id ],
                    'include_children' => true,
                ],
                [
                    'taxonomy' => 'product_tag',
                    'field'    => 'slug',
                    'terms'    => [ 'nieuw' ],
                ],
            ],
            'no_found_rows'  => true,
        ] );

        $has = $q->have_posts();
        wp_reset_postdata();
        return $cache[ $term_id ] = $has;
    }
}

/**
 * NEW: Check of een product_cat de switcher "categorie_uitgelicht" aan heeft staan.
 * Per-request statische cache.
 */
if ( ! function_exists( 'lammy_term_is_featured' ) ) {
    function lammy_term_is_featured( $term_id ) {
        static $cache = [];
        $term_id = (int) $term_id;
        if ( isset( $cache[ $term_id ] ) ) return $cache[ $term_id ];

        $flag = get_term_meta( $term_id, 'categorie_uitgelicht', true );
        $is_featured = (
            $flag === '1' || $flag === 1 || $flag === true ||
            $flag === 'true' || $flag === 'on' || $flag === 'yes' ||
            (is_numeric($flag) && (int)$flag === 1) ||
            $flag === 'checked' || $flag === 'enabled'
        );

        return $cache[ $term_id ] = $is_featured;
    }
}

if ( ! function_exists( 'lammy_render_term_links_grid' ) ) {
    /**
     * Render subcategories of $parent_slug in columns.
     * $columns:
     *  - 'auto'  -> ~12 items per col, **max 4** (standaard, voor Collectie)
     *  - number  -> exact zoveel kolommen, wordt **afgekapt op 6** (b.v. Aanbiedingen)
     * NEW:
     *  - Categorieën met ≥1 product met tag "nieuw" komen eerst (override A–Z)
     *  - Voor zulke categorieën tonen we een "Nieuw" badge vóór de naam
     * @param string $parent_slug Slug van parent categorie
     * @param string|int $columns 'auto' of nummer (max 6)
     * @param bool $show_empty Toon lege categorieën
     * @param string $context Context ('aanbiedingen' voor uitgelicht badge)
     */
    function lammy_render_term_links_grid( $parent_slug, $columns = 'auto', $show_empty = true, $context = '' ) {
        $parent = get_term_by( 'slug', $parent_slug, 'product_cat' );
        if ( ! $parent || is_wp_error( $parent ) ) {
            return '<div class="mega-menu-links-grid" data-cols="1"><ul class="mega-menu-links"><li><em>Categorie niet gevonden</em></li></ul></div>';
        }
        
        // Check of dit het "Aanbiedingen" menu is (100% zeker via context parameter)
        $is_aanbiedingen_menu = ( $context === 'aanbiedingen' || strtolower( $parent_slug ) === 'aanbiedingen' || strtolower( $parent->name ) === 'aanbiedingen' );

        $terms = get_terms( [
            'taxonomy'   => 'product_cat',
            'parent'     => (int) $parent->term_id,
            'hide_empty' => ! (bool) $show_empty,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ] );
        if ( is_wp_error( $terms ) ) {
            return '<div class="mega-menu-links-grid" data-cols="1"><ul class="mega-menu-links"><li><em>Fout bij laden</em></li></ul></div>';
        }

        // Altijd container teruggeven zodat :hover iets kan tonen
        if ( empty( $terms ) ) {
            return '<div class="mega-menu-links-grid" data-cols="1"><ul class="mega-menu-links"><li><em>Geen subcategorieën</em></li></ul></div>';
        }

        // NEW: Bepalen welke cats "nieuw" bevatten + uitgelicht zijn
        // Voor Aanbiedingen menu: behoud A-Z sorting (uitgelicht alleen badge, geen prioriteit)
        // Voor andere menu's: "nieuw" eerst, dan A-Z
        $meta = [];
        foreach ( $terms as $t ) {
            $meta[ $t->term_id ] = [
                'has_new'     => lammy_term_has_new_product( $t->term_id ),
                'is_featured' => $is_aanbiedingen_menu ? lammy_term_is_featured( $t->term_id ) : false,
                'name'        => function_exists('mb_strtolower') ? mb_strtolower( $t->name, 'UTF-8' ) : strtolower( $t->name ),
            ];
        }
        
        // Sorting: 
        // - Aanbiedingen menu: "Nieuw" eerst, dan A-Z (uitgelicht blijft op originele plek, alleen badge)
        // - Andere menu's: "nieuw" eerst, dan A-Z
        if ( $is_aanbiedingen_menu ) {
            // Aanbiedingen: "Nieuw" eerst, dan A-Z (uitgelicht heeft geen sorting prioriteit)
            usort( $terms, function( $a, $b ) use ( $meta ) {
                $an = $meta[ $a->term_id ]['has_new'];
                $bn = $meta[ $b->term_id ]['has_new'];
                // "Nieuw" eerst
                if ( $an !== $bn ) return $an ? -1 : 1;
                // Daarna A–Z (uitgelicht blijft op originele plek)
                return strcmp( $meta[ $a->term_id ]['name'], $meta[ $b->term_id ]['name'] );
            } );
        } else {
            // Andere menu's: "nieuw" eerst, dan A-Z
            usort( $terms, function( $a, $b ) use ( $meta ) {
                $an = $meta[ $a->term_id ]['has_new'];
                $bn = $meta[ $b->term_id ]['has_new'];
                // "Nieuw" eerst
                if ( $an !== $bn ) return $an ? -1 : 1;
                // Daarna A–Z
                return strcmp( $meta[ $a->term_id ]['name'], $meta[ $b->term_id ]['name'] );
            } );
        }

        // Kolommen bepalen
        if ( $columns === 'auto' ) {
            $max_per_col = 12;
            $cols = max( 1, min( 4, (int) ceil( count( $terms ) / $max_per_col ) ) ); // **max 4** bij auto
        } else {
            $cols = max( 1, min( 6, (int) $columns ) ); // numeriek mag tot **6**
        }

        $per_col = (int) ceil( count( $terms ) / $cols );
        $chunks  = array_chunk( $terms, $per_col );

        // NEW: Badge CSS één keer per request printen
        static $badge_printed = false;
        $badge_css = '';
        if ( ! $badge_printed ) {
            $badge_css = '<style>
                .mega-menu .lammy-badge-nieuw{display:inline-block;margin-right:.5rem;padding:.18rem .5rem;border-radius:999px;background:#004494;color:#fff;font-weight:700;font-size:.72rem;line-height:1;vertical-align:middle}
                .mega-menu .lammy-badge-uitgelicht{display:inline-block;margin-right:.5rem;padding:.18rem .5rem;border-radius:999px;background:#d1152f;color:#fff;font-weight:700;font-size:.72rem;line-height:1;vertical-align:middle}
            </style>';
            $badge_printed = true;
        }

        ob_start();
        echo $badge_css;
        echo '<div class="mega-menu-links-grid" data-cols="' . (int) $cols . '">';
        foreach ( $chunks as $chunk ) {
            echo '<ul class="mega-menu-links">';
            foreach ( $chunk as $term ) {
                $url = get_term_link( $term );
                if ( is_wp_error( $url ) ) continue;

                $has_new     = isset( $meta[ $term->term_id ] ) ? $meta[ $term->term_id ]['has_new'] : false;
                $is_featured = isset( $meta[ $term->term_id ] ) ? $meta[ $term->term_id ]['is_featured'] : false;
                
                $badges = '';
                // In Aanbiedingen menu: toon uitgelicht badge (rood met alleen 🤩 emoji), anders alleen "Nieuw" badge
                if ( $is_aanbiedingen_menu && $is_featured ) {
                    $badges .= '<span class="lammy-badge-uitgelicht">🤩</span> ';
                } elseif ( $has_new ) {
                    $badges .= '<span class="lammy-badge-nieuw">Nieuw</span> ';
                }
                
                $label = $badges . esc_html( $term->name );
                
                // Bulletproof HTML sanitization (laat badge spans door)
                $allowed = [
                    'span' => [
                        'class' => true,
                    ]
                ];
                $safe_label = wp_kses( $label, $allowed );

                printf( '<li><a href="%s">%s</a></li>', esc_url( $url ), $safe_label );
            }
            echo '</ul>';
        }
        echo '</div>';
        
        $html = ob_get_clean();
        
        // DEBUG: Bewijs dat nieuwe code draait (verwijder later)
        if ( $is_aanbiedingen_menu ) {
            $html .= "\n<!-- LAMMY_AANBIEDINGEN_RENDER v=" . esc_html(lammy_megamenu_cache_version()) . " file=" . esc_html(__FILE__) . " context=" . esc_html($context) . " -->\n";
        }
        
        return $html;
    }
}

/* ---------- Shortcodes (register early) ---------- */
function lammy_register_megamenu_shortcodes() {

    // Reusable column block
    add_shortcode( 'lammy_megamenu_col', function( $atts ) {
        $a = shortcode_atts( [
            'parent'     => '',
            'title'      => '',
            'columns'    => 'auto', // 'auto' (max 4) of 1..6
            'show_empty' => '1',    // '1' = toon lege subcats (nieuwe direct zichtbaar)
        ], $atts );
        if ( empty( $a['parent'] ) ) return '';

        // Determine context for uitgelicht badge
        $context = '';
        if ( strtolower( $a['parent'] ) === 'aanbiedingen' ) {
            $context = 'aanbiedingen';
        }
        
        $cache_key = 'lammy_megacol_v3_' . md5( serialize( $a ) ) . '_' . lammy_megamenu_cache_version();
        $cached    = get_transient( $cache_key );
        if ( $cached !== false ) return $cached;

        ob_start();
        echo '<div class="mega-menu-column">';
        if ( $a['title'] !== '' ) {
            printf( '<h3>%s</h3>', esc_html( $a['title'] ) );
        }
        echo lammy_render_term_links_grid(
            sanitize_title( $a['parent'] ),
            $a['columns'],
            $a['show_empty'] === '1',
            $context
        );
        echo '</div>';
        $html = ob_get_clean();

        set_transient( $cache_key, $html, 12 * HOUR_IN_SECONDS );
        return $html;
    } );

    // Collectie mega-menu (auto -> max 4)
    add_shortcode( 'lammy_collectie_megamenu', function() {
        $cache_key = 'lammy_collectie_megamenu_v3_' . lammy_megamenu_cache_version();
        $cached    = get_transient( $cache_key );
        if ( $cached !== false ) return $cached;

        ob_start(); ?>
        <div class="mega-menu">
            <div class="mega-menu-content" style="grid-template-columns: 2fr 1.5fr 1.5fr 1fr;">
                <?php
                echo do_shortcode( '[lammy_megamenu_col parent="klassieke-garens" title="Klassieke Garens" columns="auto" show_empty="1"]' ); // auto (max 4)
                echo do_shortcode( '[lammy_megamenu_col parent="fantasie-garens" title="Fantasie Garens" columns="auto" show_empty="1"]' );    // auto (max 4)
                echo do_shortcode( '[lammy_megamenu_col parent="katoenen-garens" title="Katoenen Garens" columns="3" show_empty="1"]' );      // expliciet 3
                echo '<div class="mega-menu-column">';
                    echo do_shortcode( '[lammy_megamenu_col parent="haakkatoen" title="Haakkatoen" columns="auto" show_empty="1"]' );          // auto (max 4)
                    $naalden_url     = lammy_safe_term_link_by_slug( 'brei-haaknaalden' );
                    $accessoires_url = lammy_safe_term_link_by_slug( 'accessoires' );
                    if ( $naalden_url || $accessoires_url ) {
                        echo '<h3 style="margin-top:20px;">Brei- en haaknaalden</h3><ul class="mega-menu-links">';
                        if ( $naalden_url )     echo '<li><a href="' . esc_url( $naalden_url ) . '">Alle Naalden</a></li>';
                        if ( $accessoires_url ) echo '<li><a href="' . esc_url( $accessoires_url ) . '">Accessoires</a></li>';
                        echo '</ul>';
                    }
                echo '</div>';
                ?>
            </div>
        </div>
        <?php
        $html = ob_get_clean();
        set_transient( $cache_key, $html, 12 * HOUR_IN_SECONDS );
        return $html;
    } );

    // Aanbiedingen mega-menu – breder en tot 6 kolommen
    add_shortcode( 'lammy_aanbiedingen_megamenu', function() {
        $cache_key = 'lammy_aanbiedingen_megamenu_v2_' . lammy_megamenu_cache_version();
        $cached    = get_transient( $cache_key );
        if ( $cached !== false ) return $cached;

        ob_start(); ?>
        <div class="mega-menu" style="min-width:1100px;max-width:1400px;">
            <div class="mega-menu-content" style="grid-template-columns: 1fr; gap:28px;">
                <?php
                // columns=6 -> lammy_render cap’t op 6, dus netjes maximaal 6 kolommen
                echo do_shortcode( '[lammy_megamenu_col parent="aanbiedingen" title="Aanbiedingen" columns="6" show_empty="1"]' );
                ?>
            </div>
        </div>
        <?php
        $html = ob_get_clean();
        
        // DEBUG: Bewijs dat nieuwe code draait
        $html .= "\n<!-- LAMMY_AANBIEDINGEN_MEGAMENU v=" . esc_html(lammy_megamenu_cache_version()) . " file=" . esc_html(__FILE__) . " -->\n";
        
        set_transient( $cache_key, $html, 12 * HOUR_IN_SECONDS );
        return $html;
    } );
}
add_action( 'init', 'lammy_register_megamenu_shortcodes', 5 );

/* ---------- Cache flush bij wijzigingen ---------- */
if ( ! function_exists( 'lammy_megamenu_flush_cache_all' ) ) {
    function lammy_megamenu_flush_cache_all() {
        // Bump cache version (automatisch invalideert alle versieerde keys)
        lammy_megamenu_bump_cache_version();
        
        // Legacy cleanup (voor oude niet-versieerde keys)
        global $wpdb;
        delete_transient( 'lammy_collectie_megamenu_v3' );
        delete_transient( 'lammy_aanbiedingen_megamenu_v2' );
        if ( isset( $wpdb->options ) ) {
            $wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_lammy_megacol_v3_%'" );
            $wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_lammy_megacol_v3_%'" );
        }
        delete_option( 'product_cat_children' );
        if ( function_exists( 'wp_cache_flush' ) ) wp_cache_flush();
    }
}
add_action( 'save_post_product', 'lammy_megamenu_flush_cache_all' );
add_action( 'created_product_cat', 'lammy_megamenu_flush_cache_all' );
add_action( 'edited_product_cat', 'lammy_megamenu_flush_cache_all' );
add_action( 'delete_product_cat', 'lammy_megamenu_flush_cache_all' );
// Bump cache version when term meta changes (voor categorie_uitgelicht switcher) - DEFINITIEVE FIX
add_action( 'updated_term_meta', function( $meta_id, $object_id, $meta_key ) {
    if ( $meta_key === 'categorie_uitgelicht' ) {
        $term = get_term( $object_id, 'product_cat' );
        if ( $term && ! is_wp_error( $term ) ) {
            lammy_megamenu_bump_cache_version();
        }
    }
}, 10, 3 );
add_action( 'added_term_meta', function( $meta_id, $object_id, $meta_key ) {
    if ( $meta_key === 'categorie_uitgelicht' ) {
        $term = get_term( $object_id, 'product_cat' );
        if ( $term && ! is_wp_error( $term ) ) {
            lammy_megamenu_bump_cache_version();
        }
    }
}, 10, 3 );
add_action( 'deleted_term_meta', function( $meta_ids, $object_id, $meta_key ) {
    if ( $meta_key === 'categorie_uitgelicht' ) {
        $term = get_term( $object_id, 'product_cat' );
        if ( $term && ! is_wp_error( $term ) ) {
            lammy_megamenu_bump_cache_version();
        }
    }
}, 10, 3 );

/* ---------- AJAX endpoints (return rendered HTML) ---------- */
add_action( 'wp_ajax_nopriv_lammy_megamenu_html', 'lammy_megamenu_ajax' );
add_action( 'wp_ajax_lammy_megamenu_html',        'lammy_megamenu_ajax' );
function lammy_megamenu_ajax() {
    // Prevent caching of AJAX responses
    nocache_headers();
    
    $type = isset( $_GET['type'] ) ? sanitize_key( $_GET['type'] ) : '';
    if ( $type === 'collectie' ) {
        wp_send_json_success( do_shortcode( '[lammy_collectie_megamenu]' ) );
    } elseif ( $type === 'aanbiedingen' ) {
        wp_send_json_success( do_shortcode( '[lammy_aanbiedingen_megamenu]' ) );
    }
    wp_send_json_error();
}

/* ---------- Front-end injector (works even if header can’t run PHP) ---------- */
add_action( 'wp_footer', function () {
    $ajax = admin_url( 'admin-ajax.php?action=lammy_megamenu_html&type=' );
    ?>
    <script>
    (function(){
        var ajaxBase = <?php echo json_encode( $ajax ); ?>;

        function closestNavItemFromAnchor(a){
            var el = a;
            while (el && el !== document && !(el.classList && el.classList.contains('nav-item'))) {
                el = el.parentNode;
            }
            return (el && el.classList && el.classList.contains('nav-item')) ? el : null;
        }

        function findCollectieNavItem(){
            var ni = document.querySelector('.nav-item.collectie-nav');
            if (ni) return ni;
            var links = document.querySelectorAll('nav .nav-link, .main-nav .nav-link, a');
            for (var i=0;i<links.length;i++){
                var t = (links[i].textContent||'').trim().toLowerCase();
                if (t === 'collectie') {
                    var n = closestNavItemFromAnchor(links[i]);
                    if (n) return n;
                }
            }
            var a = document.querySelector('a[href*="/collectie"]');
            return a ? closestNavItemFromAnchor(a) : null;
        }

        function findAanbiedingenNavItem(){
            var a = document.querySelector('a[href*="/aanbiedingen"]');
            if (a) {
                var n = closestNavItemFromAnchor(a);
                if (n) return n;
            }
            var links = document.querySelectorAll('nav .nav-link, .main-nav .nav-link, a');
            for (var i=0;i<links.length;i++){
                var t = (links[i].textContent||'').trim().toLowerCase();
                if (t === 'aanbiedingen') {
                    var n2 = closestNavItemFromAnchor(links[i]);
                    if (n2) return n2;
                }
            }
            return null;
        }

        function injectOnce(type, navItem){
            if (!navItem) return;
            if (navItem.dataset.megaAttached === '1' || navItem.dataset.megaPending === '1') return;

            // Als er al een .mega-menu staat -> niets doen en wel markeren
            if (navItem.querySelector('.mega-menu')) {
                navItem.dataset.megaAttached = '1';
                return;
            }

            navItem.dataset.megaPending = '1'; // voorkom dubbele fetch/inject

            fetch(ajaxBase + encodeURIComponent(type), { credentials:'same-origin' })
              .then(function(r){ return r.json(); })
              .then(function(payload){
                  if (payload && payload.success && payload.data) {
                      // dubbelcheck: niet opnieuw als intussen aanwezig
                      if (!navItem.querySelector('.mega-menu')) {
                          navItem.insertAdjacentHTML('beforeend', payload.data);
                      }
                      navItem.dataset.megaAttached = '1';
                  }
              })
              .catch(function(){})
              .finally(function(){
                  navItem.dataset.megaPending = '';
              });
        }

        function run(){
            var c = findCollectieNavItem();
            if (c) injectOnce('collectie', c);

            var d = findAanbiedingenNavItem();
            if (d) injectOnce('aanbiedingen', d);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }

        // Observeer heel even voor late mounts, maar injecteer slechts 1x per item
        var mo = new MutationObserver(function(){ run(); });
        mo.observe(document.documentElement, { childList:true, subtree:true });
        setTimeout(function(){ mo.disconnect(); }, 5000);
    })();
    </script>
    <?php
}, 99 );
