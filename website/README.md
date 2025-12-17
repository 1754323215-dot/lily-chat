# Lily官方网站

基于腾讯官网模板设计的Lily公司官方网站，采用白色主题。

## 功能特点

- 响应式设计，支持移动端和桌面端
- 三个主要导航页面：产品、直招、直聊
- 现代化的UI设计
- 平滑滚动和动画效果

## 安装和运行

1. 安装依赖：
```bash
cd website
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 在浏览器中访问：
```
http://localhost:8084
```

## 项目结构

```
website/
├── server.js          # Express服务器
├── package.json       # 项目配置和依赖
├── public/           # 静态文件目录
│   ├── index.html    # 主HTML文件
│   ├── styles.css    # 样式文件
│   └── script.js     # JavaScript交互文件
└── README.md         # 项目说明
```

## 页面说明

- **产品页面**：展示公司的主要产品和服务
- **直招页面**：显示招聘信息和职位列表
- **直聊页面**：介绍直聊服务功能

## 技术栈

- Node.js + Express（服务器）
- HTML5 + CSS3（前端）
- Vanilla JavaScript（交互）
