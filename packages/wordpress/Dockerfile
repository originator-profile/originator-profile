FROM wordpress:7.1.3-php8.2@sha256:841fdef84001500e47ccc605a9429ecd0dc3df83735636645d2ba0563679998d AS builder

RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" \
  && php composer-setup.php --install-dir=/usr/local/bin --filename=composer \
  && php -r "unlink('composer-setup.php');"

RUN apt-get update \
  && apt-get install -y --no-install-recommends zip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html/wp-content/plugins/ca-manager
COPY . .
RUN composer install --no-dev \
  && zip -r /wordpress-ca-manager.zip .

FROM scratch AS artifact
COPY --from=builder /wordpress-ca-manager.zip .
