/**
 * NATS/JetStream client side configuration options.
 * @interface ClientOptions
 */
export interface ClientOptions {
	/**
	 * List of servers to use. in [{protocol}://]{host}[:{port}] format.
	 * @type {string | string[]}
	 */
	servers: string | string[];

	/**
	 * Set the credentials to use when connecting to the server.
	 * @type {ClientCredentials}
	 */
	credentials: ClientCredentials;

	/**
	 * Configure if a secure channel must be used.
	 * @type {ClientTlsConfig | undefined}
	 * @default 'auto'
	 */
	tls?: ClientTlsConfig;

	/**
	 * Custom name to identify this client.
	 * @type {string}
	 */
	name: string;

	/**
	 * Instructs the server to also send messages published by this connection to subscribers
	 * registered by it.
	 * @type {boolean | undefined}
	 * @default false
	 */
	enableEcho?: boolean;

	/**
	 * If 'true' the client will print protocol messages sent and received. DO NOT use in production environments.
	 * @type {boolean | undefined}
	 * @default false
	 */
	debug?: boolean;
};

/**
 * Credentials to use when establishing a connection to the server.
 * @@type ClientCredentials
 */
export type ClientCredentials = ClientCredentialsJWT | ClientCredentialsLegacy | ClientCredentialsToken;

/**
 * Credentials to use when establishing a connection to the server.
 * @interface ClientCredentialsJWT
 */
export interface ClientCredentialsJWT {
	/**
	 * The JWT describes the account to use and its capabilities.
	 * @type {string}
	 */
	jwt: string;

	/**
	 * The nkeySeed is like a password.
	 * @type {string}
	 */
	nkeySeed: string;
};

/**
 * Legacy credentials to use when establishing a connection to the server.
 * @interface ClientCredentialsLegacy
 */
export interface ClientCredentialsLegacy {
	/**
	 * User name.
	 * @type {string}
	 */
	username: string;

	/**
	 * Password.
	 * @type {string}
	 */
	password: string;
};

/**
 * Credentials to use when establishing a connection to the server with a token.
 * @interface ClientCredentialsToken
 */
export interface ClientCredentialsToken {
	/**
	 * Access token.
	 * @type {string}
	 */
	token: string;
};

/**
 * TLS configuration to use.
 * @type ClientTlsConfig
 */
export type ClientTlsConfig = ClientTlsOptions | 'always' | 'never' | 'auto'

/**
 * TLS configuration options used while connecting to a server.
 * @interface ClientTlsOptions
 */
export interface ClientTlsOptions {
	/**
	 * Forces to use TLS.
	 * @type {boolean | undefined}
	 */
	enforce?: boolean;

	/**
	 * Certificate file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	certFile?: string;
	/**
	 * Certificate to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	cert?: string;
	/**
	 * Certificate authority file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	caFile?: string;

	/**
	 * Certificate authority to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	ca?: string;

	/**
	 * Private key file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	keyFile?: string;

	/**
	 * Private key to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	key?: string;
};

/**
 * Define an interface for the events and their corresponding listener arguments
 * @interface ClientEventsMap
 */
export interface ClientEventsMap {
	'status': [ connection: 'connected' | 'disconnected' ];
}
