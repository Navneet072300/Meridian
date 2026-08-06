package db

import "time"

type User struct {
	ID                int
	Email             *string
	Phone             *string
	Name              string
	AvatarURL         *string
	AvatarColor       string
	Provider          string
	ProviderID        *string
	HashedPassword    *string
	EmailVerified     bool
	PhoneVerified     bool
	Plan              string
	Role              string
	TOTPSecret        *string
	TOTPEnabled       bool
	TOTPPendingSecret *string
	CreatedAt         time.Time
}

type OTPCode struct {
	ID        int
	Contact   string
	Code      string
	ExpiresAt time.Time
	Used      bool
	CreatedAt time.Time
}

type UserSession struct {
	ID               int
	UserID           int
	SessionTokenHash string
	DeviceInfo       string
	IPAddress        string
	LastActive       time.Time
	CreatedAt        time.Time
	IsRevoked        bool
}

type APIKey struct {
	ID         int
	UserID     int
	Name       string
	KeyPrefix  string
	KeyHash    string
	Scopes     string
	ExpiresAt  *time.Time
	LastUsedAt *time.Time
	CreatedAt  time.Time
	IsRevoked  bool
}

type GenerateSession struct {
	ID        int
	UserID    int
	Title     string
	Prompt    string
	Tools     string
	Context   string
	FilesJSON string
	MetaJSON  string
	CreatedAt time.Time
}

type UserSettings struct {
	ID                    int
	UserID                int
	Timezone              string
	DefaultEnvironment    string
	DefaultIACTool        string
	DefaultCloud          string
	DefaultNamespace      string
	CodeFontSize          int
	AvatarColor           string
	NotificationPrefs     string
	AIPrimaryEndpoint     string
	AIPrimaryModel        string
	AISecondaryEndpoint   string
	AISecondaryModel      string
	AITemperature         string
	AIMaxTokens           int
	AIStreaming           bool
	AISystemPromptAddendum string
	WorkspaceName         string
	Require2FATeam        bool
	DefaultMemberRole     string
	ExperienceLevel       *string
	SecretsJSON           string
	GrafanaOrgID          *int
	MonitoringEnabled     bool
	UpdatedAt             time.Time
}

type TeamMember struct {
	ID               int
	WorkspaceOwnerID int
	UserID           *int
	Email            string
	Name             string
	Role             string
	JoinedAt         time.Time
}

type TeamInvite struct {
	ID               int
	WorkspaceOwnerID int
	Email            string
	Role             string
	Token            string
	ExpiresAt        time.Time
	CreatedAt        time.Time
	IsCancelled      bool
}

type AuditLog struct {
	ID        int
	UserID    *int
	UserEmail string
	Action    string
	Resource  string
	IPAddress string
	Status    string
	Details   *string
	CreatedAt time.Time
}

type DeployConfig struct {
	ID                         int
	UserID                     int
	RepoFullName               string
	Branch                     string
	Language                   string
	Framework                  string
	CITool                     string
	Registry                   string
	SecretsManager             string
	DeployTarget               string
	Port                       int
	LastVerificationStatus     string
	LastVerificationStartedAt  *time.Time
	LastVerificationEndedAt    *time.Time
	LastVerificationDetail     *string
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

type AgentToken struct {
	ID           string
	UserID       int
	ClusterName  string
	Token        string
	TokenPrefix  string
	IsActive     bool
	LastSeenAt   *time.Time
	AgentVersion *string
	CreatedAt    time.Time
}

type AlertChannel struct {
	ID              string
	UserID          int
	ChannelType     string
	Name            string
	ConfigEncrypted string
	IsActive        bool
	AlertOn         string
	CreatedAt       time.Time
}

type UserSecret struct {
	ID             string
	UserID         int
	Name           string
	ValueEncrypted string
	SecretType     string
	Description    *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
