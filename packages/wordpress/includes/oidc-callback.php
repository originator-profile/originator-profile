<?php
/** OIDC認証用コールバックページ設定 */

namespace Profile\CasApiOidcCallback;

// OIDC callback page name.
const OIDC_CALLBACK_ENDPOINT = 'oidc-callback';

// OIDC callback page.
const OIDC_CALLBACK_PAGE = 'page-oidc-callback.php';

// Error page URL.
const ERROR_PAGE_404 = '/404';

function activation() {
    \add_rewrite_endpoint( OIDC_CALLBACK_ENDPOINT, EP_ROOT );
    \flush_rewrite_rules();
}

function deactivation() {
    \add_rewrite_endpoint( OIDC_CALLBACK_ENDPOINT, EP_NONE );
    \flush_rewrite_rules();
}

function init() {
    \add_filter( 'query_vars', '\Profile\CasApiOidcCallback\oidc_query_vars' );
    \add_action( 'template_redirect', '\Profile\CasApiOidcCallback\oidc_callback_page' );
}

function oidc_query_vars( $vars ) {
    $vars[] = OIDC_CALLBACK_ENDPOINT;
    return $vars;
}

function oidc_callback_page() {
    global $wp_query;

    // Check if the current request is for the OIDC callback endpoint.
    if ( isset( $wp_query->query_vars[OIDC_CALLBACK_ENDPOINT] ) ) {

        // Check if the user is logged in.
        if ( ! \is_user_logged_in() ) {
            \wp_redirect(home_url(ERROR_PAGE_404));
            exit;
        }

        // Check if the user is an administrator.
        if ( ! \current_user_can( 'manage_options' ) ) {
            \wp_redirect(home_url(ERROR_PAGE_404));
            exit;
        }

        // Check if the admin secret is set.
        $admin_secret = \get_option( 'profile_ca_server_admin_secret', null );
        if ( ! $admin_secret ) {
            \wp_redirect(home_url(ERROR_PAGE_404));
            exit;
        }
        // Check if the authentication type is OIDC.
        $secret_arr = explode( ':', $admin_secret );
        $auth_type  = $secret_arr[0] ?? '';
        if ( $auth_type !== 'OIDC' ) {
            \wp_redirect(home_url(ERROR_PAGE_404));
            exit;
        }

        // OIDC Authentication page.
        include __DIR__ . '/' . OIDC_CALLBACK_PAGE;
        exit;
    }
}
