# ใช้ Node.js 18 บน Alpine Linux (image เล็ก ใช้ memory น้อย)
FROM node:18-alpine

# กำหนด working directory ใน container
WORKDIR /app

# Copy package.json ก่อน (เพื่อใช้ Docker layer caching)
# ถ้า package.json ไม่เปลี่ยน → Docker จะใช้ cached npm install
# ทำให้ build เร็วขึ้นมาก
COPY package*.json ./

# ติดตั้ง dependencies (--production = ไม่ติดตั้ง devDependencies)
RUN npm install --production

# Copy โค้ดทั้งหมด
COPY . .

# บอก Docker ว่า container นี้ใช้ port 80
EXPOSE 80

# คำสั่งที่รันเมื่อ container เริ่มทำงาน
CMD ["node", "server.js"]
