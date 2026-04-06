FROM wordpress:6.9.4-php8.5 AS builder

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
