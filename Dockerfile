# Node.js alap image
FROM node:18

# Munkakönyvtár létrehozása
WORKDIR /usr/src/app

# Függőségek telepítése
COPY package*.json ./
RUN npm install

# Projekt fájlok másolása
COPY . .

# Környezeti változók
COPY .env .env

# Port nyitása
EXPOSE 3000

# Alkalmazás indítása
CMD ["node", "app.js"]
