# CivicSense App - State Chart Diagram & Components

## 🗺️ **State Chart Diagram** (Mermaid Syntax)
Copy to [mermaid.live](https://mermaid.live) to visualize.

```mermaid
stateDiagram-v2
    [*] --> Idle : App Start
    Idle --> Authenticating : Login/Signup
    Authenticating --> Authenticated : Success
    Authenticating --> Idle : Fail
    
    Authenticated --> CitizenMode : Citizen Login
    Authenticated --> AdminMode : Admin Login
    
    %% Citizen Flow
    CitizenMode --> ReportingIssue : Report Issue
    ReportingIssue --> UploadingMedia : Photo/Video + AI Check
    UploadingMedia --> ProcessingAI : AI Image Check
    ProcessingAI --> IssueSubmitted : Submit Success
    IssueSubmitted --> CitizenDashboard : View My Issues
    ProcessingAI --> ReportingIssue : AI Fail/Retry
    
    CitizenDashboard --> ViewingIssues : Track Status
    ViewingIssues --> Idle : Logout
    
    %% Admin Flow
    AdminMode --> AdminDashboard : View All Issues
    AdminDashboard --> AssigningIssue : Assign to Team
    AssigningIssue --> IssueAssigned : Success
    AdminDashboard --> LiveDetection : AI Live Monitoring
    LiveDetection --> DetectedIssues : Alert Found
    
    %% Shared
    IssueSubmitted --> PendingReview
    PendingReview --> Assigned : Admin Assigns
    Assigned --> Resolved : Work Complete
    Resolved --> Closed
    
    ViewingIssues --> Closed : View Resolved
    AdminDashboard --> Closed : View Closed
    Closed --> [*]
    
    note right of ReportingIssue
        States:
        - Form Fill
        - Media Capture
        - Voice Report
        - Location
    end note
    
    note right of AdminDashboard
        Real-time Socket.IO Updates
        Push Notifications
    end note
```

## 🏗️ **Components Breakdown**

### **Backend Components** (`Backend/`)
```
server.js (Main)
├── Routes
│   ├── authRoute.js (Login/Signup/JWT)
│   └── issueRoute.js (CRUD Issues)
├── Controllers
│   ├── authController.js (Auth logic)
│   └── issueController.js (Issue ops)
├── Models (Mongoose)
│   ├── User.js (name, email, role, isActive)
│   └── IssueReport.js (title, desc, media[], status, location)
├── Middleware
│   └── auth.js (JWT verify)
└── Socket.IO (Real-time updates)
```

### **Frontend Components** (`Frontend/src/`)
```
App.js (Router)
├── Pages
│   ├── Login/Signup (Auth)
│   ├── CitizenDashboard (My Issues)
│   ├── ReportIssue (Capture + AI Check)
│   ├── AdminDashboard (All Issues)
│   └── AdminLiveDetection (RT Monitoring)
├── Components
│   ├── LanguageSelector (i18n)
│   ├── EmergencyAlertSystem (Push)
│   └── VoiceReporter (Speech-to-text)
├── Utils
│   ├── aiImageDetector.js (Fake image check)
│   └── voiceReporter.js
└── i18n (EN/HI/TE)
```

## 🔄 **Key State Transitions**
| From → To | Trigger | Component |
|-----------|---------|-----------|
| Idle → Authenticating | User clicks Login | Login Page |
| ReportingIssue → ProcessingAI | Submit Photo | aiImageDetector |
| PendingReview → Assigned | Admin assigns | AdminDashboard |
| Any → Push Notification | Status change | Socket.IO + WebPush |

**Usage**: Paste Mermaid code to mermaid.live for interactive diagram. Components map directly to files.

