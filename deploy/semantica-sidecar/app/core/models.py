"""
Models Pydantic — espelham src/lib/semantica/types.ts do TypeScript.
"""

from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field


# ============================================================================
# Entity Types
# ============================================================================

EntityType = Literal[
    "RULE", "POLICY", "AMENITY", "CHECKIN", "CHECKOUT",
    "PAYMENT", "CANCEL", "SERVICE", "GUEST", "RESERVATION",
    "ROOM", "FAQ", "CUSTOM"
]

RelationType = Literal[
    "SUPERSEDES", "FORBIDS", "REQUIRES", "OVERLAPS",
    "ENABLES", "CAUSED", "INFLUENCED", "PRECEDENT_FOR"
]

ConflictSeverity = Literal["low", "medium", "high", "critical"]
ConflictStatus = Literal["detected", "acknowledged", "resolved", "ignored"]
DecisionCategory = Literal[
    "guest_response", "intent_classification", "tool_calling",
    "human_handover", "message_blocked", "graph_query",
    "refactor_suggestion", "budget_alert", "anomaly_detected"
]
DecisionOutcome = Literal[
    "success", "partial_success", "failure",
    "escalated", "blocked", "pending"
]


# ============================================================================
# Graph Nodes & Edges
# ============================================================================

class ProvenanceInfo(BaseModel):
    source: str
    sourceRef: Optional[str] = None
    extractedBy: Optional[str] = None
    guestId: Optional[str] = None
    extractedAt: datetime = Field(default_factory=datetime.now)


class ContextNode(BaseModel):
    id: str
    tenantId: str
    type: EntityType
    name: str
    content: str
    embedding: Optional[List[float]] = None
    provenance: Optional[ProvenanceInfo] = None
    confidence: Optional[float] = None
    forgotten: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: Optional[datetime] = None


class GraphEdge(BaseModel):
    id: str
    tenantId: str
    sourceNodeId: str
    targetNodeId: str
    relationType: RelationType
    priorityWeight: int = 1
    condition: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)


class AddNodeRequest(BaseModel):
    tenantId: str
    type: EntityType
    name: str
    content: str
    provenance: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None


class AddEdgeRequest(BaseModel):
    tenantId: str
    sourceNodeId: str
    targetNodeId: str
    relationType: RelationType
    priorityWeight: int = 1
    condition: Optional[str] = None


class UpdateNodeRequest(BaseModel):
    tenantId: str
    name: Optional[str] = None
    content: Optional[str] = None
    confidence: Optional[float] = None


# ============================================================================
# Search
# ============================================================================

class HybridSearchRequest(BaseModel):
    tenantId: str
    query: str
    hops: int = 2
    maxNodes: int = 5
    includeConflicts: bool = False
    noCache: bool = False


class SearchMeta(BaseModel):
    totalNodesScanned: int
    totalEdgesTraversed: int
    cacheHit: bool
    latencyMs: int
    source: Literal["semantica", "fallback"]


class HybridSearchResult(BaseModel):
    nodes: List[ContextNode]
    edges: List[GraphEdge]
    resolvedContext: str
    conflicts: Optional[List["GraphConflict"]] = None
    searchMeta: SearchMeta


# ============================================================================
# Conflicts
# ============================================================================

class SuggestedResolution(BaseModel):
    type: RelationType
    winnerNodeId: str
    loserNodeId: str
    reasoning: str


class GraphConflict(BaseModel):
    id: str
    tenantId: str
    nodeIds: List[str]
    description: str
    severity: ConflictSeverity
    status: ConflictStatus
    suggestedResolution: Optional[SuggestedResolution] = None
    resolvedBy: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    detectedAt: datetime = Field(default_factory=datetime.now)


class ResolveConflictRequest(BaseModel):
    tenantId: str
    type: RelationType
    winnerNodeId: str
    loserNodeId: str
    reasoning: str


# ============================================================================
# Decisions
# ============================================================================

class DecisionMetadata(BaseModel):
    providerId: Optional[str] = None
    tier: Optional[int] = None
    latencyMs: Optional[int] = None
    sessionId: Optional[str] = None
    guestId: Optional[str] = None
    intent: Optional[str] = None
    cacheHit: Optional[bool] = None
    fallbackUsed: Optional[bool] = None


class RecordDecisionRequest(BaseModel):
    tenantId: str
    category: DecisionCategory
    scenario: str
    reasoning: str
    outcome: DecisionOutcome
    response: Optional[str] = None
    confidence: float
    metadata: Optional[DecisionMetadata] = None
    graphNodeIds: Optional[List[str]] = None
    parentDecisionId: Optional[str] = None


class DecisionRecord(BaseModel):
    id: str
    tenantId: str
    category: DecisionCategory
    scenario: str
    reasoning: str
    outcome: DecisionOutcome
    response: Optional[str] = None
    confidence: float
    metadata: Optional[DecisionMetadata] = None
    graphNodeIds: Optional[List[str]] = None
    parentDecisionId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.now)


class CausalChain(BaseModel):
    decisionId: str
    decision: DecisionRecord
    parents: List["CausalChain"] = []
    children: List["CausalChain"] = []
    depth: int = 0


class FindSimilarRequest(BaseModel):
    tenantId: str
    query: str
    maxResults: int = 5


# ============================================================================
# Ingestion
# ============================================================================

class IngestRequest(BaseModel):
    tenantId: str
    text: Optional[str] = None
    url: Optional[str] = None
    sourceType: Literal["regulamento", "faq", "politics", "manual", "ddc_edit"]
    force: bool = False


class IngestResult(BaseModel):
    tenantId: str
    nodesCreated: int
    edgesCreated: int
    conflictsDetected: int
    durationMs: int
    nodeIds: List[str] = []
    edgeIds: List[str] = []
    conflictIds: List[str] = []


# ============================================================================
# Ontology & Reasoning
# ============================================================================

class OntologyViolation(BaseModel):
    nodeId: str
    rule: str
    message: str
    severity: Literal["error", "warning"]


class OntologyValidationResult(BaseModel):
    valid: bool
    violations: List[OntologyViolation]


class ReasoningInference(BaseModel):
    subject: str
    predicate: RelationType
    object: str
    confidence: float
    explanation: str


class ReasoningResult(BaseModel):
    inferences: List[ReasoningInference]
    query: str
    durationMs: int


class ReasoningRequest(BaseModel):
    tenantId: str
    query: str


# ============================================================================
# LGPD
# ============================================================================

class ForgetGuestRequest(BaseModel):
    guestId: str
    tenantId: str
    reason: Literal["user_request", "gdpr_right_to_erasure", "data_retention_expiry", "manual"]
    authorizedBy: str


class ForgetGuestResult(BaseModel):
    guestId: str
    tenantId: str
    nodesMarkedForgotten: int
    decisionsAnonymized: int
    edgesRemoved: int
    consentLogId: str
    completedAt: datetime = Field(default_factory=datetime.now)


# ============================================================================
# Health & Stats
# ============================================================================

class SemanticaHealth(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: str
    uptime: str
    postgres: Literal["connected", "disconnected"]
    age: Literal["connected", "disconnected"]
    pgvector: Literal["connected", "disconnected"]
    totalTenants: int
    totalNodes: int
    totalEdges: int
    totalDecisions: int
    totalConflicts: int
    cacheHitRate: float


class GraphStats(BaseModel):
    tenantId: str
    totalNodes: int
    totalEdges: int
    nodesByType: Dict[str, int]
    edgesByRelation: Dict[str, int]
    conflicts: Dict[str, int]
    decisions: Dict[str, int]
    brainAge: int


# Forward refs
HybridSearchResult.model_rebuild()
CausalChain.model_rebuild()
