<?php
/**
 * CA Manager
 *
 * Plugin Name: CA Manager (Originator Profile)
 * Description: WordPress での記事の公開時の Content Attestation (CA) の発行に役立つプラグインです。
 * Version: 0.7.0-beta.1
 * Author: Originator Profile Collaborative Innovation Partnership
 * Author URI: https://originator-profile.org/
 * License: MIT
 *
 * @package Profile
 */

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

require_once __DIR__ . '/includes/admin.php';
\Profile\Admin\init();
\add_filter( 'plugin_action_links_' . \plugin_basename( __FILE__ ), '\Profile\Admin\add_action_links' );

require_once __DIR__ . '/includes/issue.php';
\Profile\Issue\init();

require_once __DIR__ . '/includes/post.php';
\Profile\Post\init();

require_once __DIR__ . '/includes/oidc-callback.php';
\Profile\CasApiOidcCallback\init();

require_once __DIR__ . '/includes/activator.php';
register_activation_hook( __FILE__, 'Profile\\Activator\\ca_manager_activate' );
register_deactivation_hook( __FILE__, 'Profile\\Activator\\ca_manager_deactivate' );
