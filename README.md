# Team

### Sujju Software Solutions

Andhra Loyola Institute of Engineering and Technology (ALIET)
Academic Year: 2025–2026

The CivicSense AI platform was designed and developed by a multidisciplinary team specializing in Full Stack Development, Artificial Intelligence, Machine Learning, and Backend Engineering.

| Name               | Role                                       | GitHub Profile                                     |
| ------------------ | ------------------------------------------ | -------------------------------------------------- |
| Uppu Chandrasekhar | Founder, Full Stack Developer, AI Engineer | https://github.com/sujjufoods4438/chinnucivicsense |
| Gogu Nageswari     | Machine Learning Engineer                  | https://github.com/NageswariGogu                   |
| Gurram Jyothi      | Backend Developer                          | https://github.com/JYOTHIGURRAM23HP1A1205          |
| Addala Tejaswini   | API and Web Developer                      | https://github.com/TejaswiniAddala                 |

## Team Contributions

### Uppu Chandrasekhar

* Project Founder and Lead Developer
* Full Stack Application Development
* AI Integration using YOLOv8 and TensorFlow
* System Architecture Design
* Cloud Deployment and DevOps
* Authentication and Security Implementation

GitHub Repository:
https://github.com/sujjufoods4438/chinnucivicsense

### Gogu Nageswari

* Machine Learning Model Development
* Dataset Preparation and Validation
* AI Testing and Performance Evaluation
* Model Training and Optimization

GitHub:
https://github.com/NageswariGogu

### Gurram Jyothi 

* Backend API Development
* Database Integration
* Authentication Middleware Development
* REST API Testing and Validation

GitHub:
https://github.com/JYOTHIGURRAM23HP1A1205

### Addala Tejaswini

* API Integration
* Frontend and Backend Coordination
* User Interface Enhancements
* Web Application Testing and Validation

GitHub:
https://github.com/TejaswiniAddala

# CivicSense AI

## AI-Powered Civic Issue Detection and Urban Management Platform

CivicSense AI is an intelligent web and mobile platform designed to help citizens and municipal authorities collaboratively detect, report, monitor, and resolve civic issues. By integrating Artificial Intelligence, GPS-based location tracking, real-time analytics, and cloud infrastructure, the platform transforms traditional complaint management systems into a proactive and data-driven urban governance solution.

**Institution:** Andhra Loyola Institute of Engineering and Technology (ALIET)
**Academic Year:** 2025–2026

---

# Table of Contents

1. Abstract
2. Problem Statement
3. Proposed Solution
4. Key Features
5. Application Modules
6. Technology Stack
7. System Architecture
8. Comparison with Existing Systems
9. AI Validation Results
10. Testing and Validation
11. Installation Guide
12. Deployment
13. Conclusion
14. Team
15. License

---

# Abstract

CivicSense AI is an advanced civic issue management platform that enables citizens to report urban infrastructure problems such as potholes, garbage overflow, and streetlight failures using images, voice input, and geolocation data.

The platform leverages Deep Learning models for image validation, Natural Language Processing for text and voice understanding, predictive analytics for future issue forecasting, and real-time dashboards for administrators. The system improves reporting accuracy, reduces response time, and enhances transparency between citizens and governing authorities.

**Keywords:** Civic Issue Detection, Deep Learning, Computer Vision, Predictive Analytics, Urban Management, GPS Tracking, MERN Stack, Flask API

---

# Problem Statement

Urban areas frequently experience civic infrastructure issues that remain unresolved due to inefficient reporting and management processes.

Key challenges include:

| Problem                         | Impact                                               |
| ------------------------------- | ---------------------------------------------------- |
| Delayed complaint reporting     | Citizens often lack a convenient reporting mechanism |
| Manual issue categorization     | Slow and error-prone complaint processing            |
| Lack of predictive maintenance  | Issues are addressed only after escalation           |
| Limited communication           | Citizens receive little or no status updates         |
| Inaccurate location information | Authorities struggle to locate reported issues       |

These challenges result in delayed resolutions, inefficient resource allocation, and reduced citizen satisfaction.

---

# Proposed Solution

CivicSense AI addresses these challenges through a four-component ecosystem.

## Citizen Application

Allows users to submit complaints using images, voice recordings, and GPS-enabled location data.

## AI-Based Issue Detection

Deep Learning models automatically classify and validate civic issues from uploaded images.

## Predictive Analytics Engine

Machine Learning algorithms analyze historical complaint data and environmental factors to predict future civic issues.

## Administrative Dashboard

Provides authorities with issue management tools, analytics, heatmaps, status tracking, and decision-support insights.

---

# Key Features

## AI Image Validation

YOLOv8 and TensorFlow CNN models validate uploaded images before complaint submission.

## GPS and Reverse Geocoding

Automatically captures precise location coordinates and converts them into human-readable addresses.

## Secure Authentication

Role-Based Access Control (RBAC), JWT authentication, and encrypted password storage using bcrypt.

## Administrative Dashboard

Provides real-time issue management, analytics, filtering, and monitoring capabilities.

## Live Complaint Tracking

Citizens can track complaint progress and status updates in real time.

## Live Camera Detection

Supports real-time issue detection using webcam input and automatic report generation.

## Geographic Heatmaps

Visual representation of issue density and severity across city regions.

## Predictive Maintenance

Machine Learning forecasts potential civic issues before they become critical.

## Cloud Deployment

Scalable deployment using Netlify, Render Cloud, and MongoDB Atlas.

---

# Application Modules

The system includes the following modules:

### Citizen Login

Secure authentication portal for citizens.

### Administrator Login

Separate administrative access with role-based authorization.

### Issue Reporting Module

Image upload, issue categorization, and automatic GPS capture.

### AI Validation Module

Displays validation results and confidence scores generated by AI models.

### Citizen Dashboard

View submitted complaints and track their status.

### Administrative Dashboard

Manage complaints, update statuses, and monitor analytics.

### Issue Heatmap

Real-time geographic visualization of civic issues.

### Issue Detail Management

Displays complaint metadata, location, timestamps, and status.

### Live Camera Detection

Real-time AI detection and automated complaint submission.

---

# Technology Stack

## Machine Learning

* YOLOv8 for object detection and issue classification
* TensorFlow CNN (`civic_model.keras`) for image validation
* Supported classes:

  * Pothole
  * Garbage Overflow
  * Streetlight Failure

Average AI inference time is under two seconds.

## Frontend

* React.js
* TensorFlow.js
* Axios
* JWT Authentication

## Backend

* Node.js
* Express.js
* Multer
* Mongoose

## Database

* MongoDB Atlas

## AI Services

* Flask API
* TensorFlow
* YOLOv8

## Security

* HTTPS
* JWT Authentication
* Role-Based Access Control
* bcrypt Password Hashing
* OWASP Security Practices

---

# System Architecture

## Four-Tier Architecture

Citizen Submission

↓

React Frontend

↓

Node.js and Express Backend

↓

Flask AI Service with YOLOv8 and CNN Models

↓

MongoDB Atlas Storage

↓

Administrative Dashboard and Resolution Workflow

---

## Architecture Layers

### Presentation Layer

* React.js Single Page Application
* Citizen and Administrator Interfaces
* JWT Authentication

### Application Layer

* Express REST APIs
* Authentication Middleware
* File Upload Management

### AI Processing Layer

* Flask AI Server
* CNN Image Validation
* YOLOv8 Object Detection

### Data Layer

* MongoDB Atlas
* Complaint Management Database

---

# CivicSense AI vs Existing Systems

| Feature             | Traditional Systems | Digital Portals       | CivicSense AI                 |
| ------------------- | ------------------- | --------------------- | ----------------------------- |
| Complaint Reporting | Manual              | Form-based            | AI-Validated Image Submission |
| Image Validation    | No                  | No                    | Yes                           |
| Location Capture    | Manual              | Manual                | Automatic GPS Tracking        |
| Authentication      | Basic               | Username and Password | JWT and RBAC                  |
| Analytics Dashboard | No                  | Limited               | Advanced Analytics            |
| Citizen Tracking    | No                  | Limited               | Real-Time Updates             |
| Scalability         | Low                 | Moderate              | Cloud Native                  |

---

# AI Validation Results

## Scenario 1: Invalid Submission

User selected "Garbage Overflow" but uploaded an unrelated screenshot.

AI Prediction:

* Website: 42.9%
* Envelope: 22.7%
* Analog Clock: 1.8%

Result:

Submission rejected due to mismatch between selected issue type and uploaded image.

## Scenario 2: Valid Submission

User selected "Garbage Overflow" and uploaded an actual garbage image.

AI Prediction:

* Trash Can
* Garbage Bin
* Dustbin

Result:

Submission validated and complaint successfully submitted.

---

# Testing and Validation

## Functional Testing

A total of fourteen test cases were executed with a 100% success rate.

| Test Case | Description                             | Status |
| --------- | --------------------------------------- | ------ |
| TC01–TC02 | AI image classification validation      | Passed |
| TC03      | Mismatched image detection              | Passed |
| TC05      | Invalid file rejection                  | Passed |
| TC07–TC08 | User registration validation            | Passed |
| TC09–TC10 | Login authentication validation         | Passed |
| TC11–TC12 | Role authorization validation           | Passed |
| TC13–TC14 | Complaint submission and status updates | Passed |

---

## Performance Metrics

| Metric               | Performance            |
| -------------------- | ---------------------- |
| Complaint Submission | Under 4 seconds        |
| AI Inference         | Under 2 seconds        |
| API Response Time    | Under 500 milliseconds |
| System Uptime        | 100%                   |

---

# Installation Guide

## Prerequisites

* Node.js 18 or higher
* Python 3.9 or higher
* MongoDB Atlas Account

---

## Clone Repository

```bash
git clone https://github.com/sujjufoods4438/chinnucivicsense.git
cd chinnucivicsense
```

## Install Frontend Dependencies

```bash
cd Frontend
npm install
```

## Install Backend Dependencies

```bash
cd ../Backend
npm install
```

## Install AI Dependencies

```bash
cd ../ai-server
pip install -r requirements.txt
```

---

## Environment Variables

Create a `.env` file inside the Backend directory.

```env
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

---

## Running the Application

### Start Backend

```bash
cd Backend
npm start
```

### Start AI Server

```bash
cd ai-server
python app.py
```

### Start Frontend

```bash
cd Frontend
npm start
```

---

# Deployment

Frontend:
https://chinnicivic.netlify.app

Backend API:
https://civicsense-backend-1.onrender.com

Database:
MongoDB Atlas Cloud

---

# Conclusion

CivicSense AI demonstrates how Artificial Intelligence, geospatial technologies, and cloud-native architectures can modernize civic issue management.

The platform provides:

* Automated AI-based complaint validation
* Accurate GPS-enabled issue reporting
* Real-time citizen and administrator communication
* Predictive analytics for proactive maintenance
* Secure and scalable cloud deployment

By reducing false complaints, improving transparency, and enabling data-driven decision-making, CivicSense AI contributes toward smarter and more responsive urban governance.

---

# Team

### Sujju Software Solutions

Andhra Loyola Institute of Engineering and Technology (ALIET)
Academic Year: 2025–2026

| Name               | Role                                       |
| ------------------ | ------------------------------------------ |
| Uppu Chandrasekhar | Founder, Full Stack Developer, AI Engineer |
| Gogu Nageswari     | Machine Learning Engineer                  |
| Gurram Jyothi      | Backend Developer                          |
| Addala Tejaswini   | API and Web Developer                      |


