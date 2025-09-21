# Usa una imagen oficial de Node.js
FROM node:22

# Crea el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código (por ejemplo, index.js, .env, etc.)
COPY . .

# Expone el puerto (aunque tu bot no lo use, Fly.io lo requiere)
EXPOSE 8080

# Comando para iniciar el bot
CMD ["npm", "start"]
