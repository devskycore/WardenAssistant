# Usa una imagen oficial de Node.js
FROM node:22

# Crea el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto
COPY package*.json ./
COPY index.js ./

# Instala las dependencias
RUN npm install

# Expone el puerto (aunque tu bot no lo use, Fly.io lo requiere)
EXPOSE 8080

# Comando para iniciar el bot
CMD ["npm", "start"]
