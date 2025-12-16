# Настройка AAAA записи (IPv6)

## Что такое AAAA запись?

AAAA запись связывает домен с IPv6 адресом (аналог A записи для IPv4).

## Настройка в Namecheap

### Шаг 1: Вход в панель управления

1. Зайдите на [namecheap.com](https://www.namecheap.com)
2. Войдите в аккаунт
3. **Domain List** → **oxxooy.online** → **Manage**

### Шаг 2: Добавление AAAA записи

1. Перейдите в **Advanced DNS** → **Host Records**
2. Нажмите **Add New Record**
3. Заполните:
   - **Type**: `AAAA Record`
   - **Host**: `@` (для основного домена) или `www` (для www поддомена)
   - **Value**: `ваш_ipv6_адрес` (например: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`)
   - **TTL**: `Automatic` (или `600` секунд)
4. Нажмите **Save** (галочка)

### Примеры:

**Для основного домена:**
- Type: `AAAA Record`
- Host: `@`
- Value: `ваш_ipv6_адрес`
- TTL: `Automatic`

**Для www поддомена:**
- Type: `AAAA Record`
- Host: `www`
- Value: `ваш_ipv6_адрес`
- TTL: `Automatic`

### Шаг 3: Ожидание распространения

Подождите **5-30 минут** для распространения DNS изменений.

### Шаг 4: Проверка

```bash
# Проверка AAAA записи
dig +short AAAA oxxooy.online
dig +short AAAA www.oxxooy.online

# Полная проверка
dig AAAA oxxooy.online
```

---

## Настройка в Cloudflare

### Шаг 1: Вход в панель Cloudflare

1. Зайдите на [cloudflare.com](https://www.cloudflare.com)
2. Войдите в аккаунт
3. Выберите домен **oxxooy.online**

### Шаг 2: Добавление AAAA записи

1. Перейдите в **DNS** → **Records**
2. Нажмите **Add record**
3. Заполните:
   - **Type**: `AAAA`
   - **Name**: `@` (для основного домена) или `www` (для www поддомена)
   - **IPv6 address**: `ваш_ipv6_адрес`
   - **Proxy status**: `DNS only` (серое облако) или `Proxied` (оранжевое облако)
   - **TTL**: `Auto`
4. Нажмите **Save**

### Примеры:

**Для основного домена:**
- Type: `AAAA`
- Name: `@`
- IPv6 address: `ваш_ipv6_адрес`
- Proxy: `DNS only` или `Proxied`
- TTL: `Auto`

**Для www поддомена:**
- Type: `AAAA`
- Name: `www`
- IPv6 address: `ваш_ipv6_адрес`
- Proxy: `DNS only` или `Proxied`
- TTL: `Auto`

### Шаг 3: Проверка

```bash
# Проверка AAAA записи
dig +short AAAA oxxooy.online
dig +short AAAA www.oxxooy.online
```

---

## Как узнать IPv6 адрес вашего сервера?

### На сервере:

```bash
# Показать все IPv6 адреса
ip -6 addr show

# Или через ifconfig
ifconfig | grep inet6

# Или через hostname
hostname -I | grep -E '([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}'
```

### Через команду:

```bash
# Показать IPv6 адрес интерфейса
ip addr show eth0 | grep inet6

# Или для всех интерфейсов
ip -6 addr | grep inet6 | awk '{print $2}' | cut -d'/' -f1
```

---

## Важно знать

1. **IPv6 адрес** имеет формат: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`
2. **Не все серверы имеют IPv6** - проверьте, есть ли у вашего сервера IPv6 адрес
3. **AAAA запись не обязательна** - если у сервера нет IPv6, AAAA запись не нужна
4. **Для Let's Encrypt** AAAA запись не требуется - достаточно A записи

---

## Проверка работы

```bash
# Проверка AAAA записи
dig AAAA oxxooy.online

# Проверка через ping6 (если установлен)
ping6 oxxooy.online

# Проверка через curl
curl -6 https://oxxooy.online
```

---

## Удаление AAAA записи

Если нужно удалить AAAA запись:

**Namecheap:**
- Advanced DNS → Host Records
- Найдите AAAA запись
- Нажмите на иконку корзины (Delete)

**Cloudflare:**
- DNS → Records
- Найдите AAAA запись
- Нажмите на три точки (⋮) → Delete

---

## Итоговая конфигурация DNS

После настройки у вас могут быть следующие записи:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 34.88.233.59 | Automatic |
| A | www | 34.88.233.59 | Automatic |
| AAAA | @ | ваш_ipv6 | Automatic |
| AAAA | www | ваш_ipv6 | Automatic |

**Примечание**: AAAA записи нужны только если у вашего сервера есть IPv6 адрес.


