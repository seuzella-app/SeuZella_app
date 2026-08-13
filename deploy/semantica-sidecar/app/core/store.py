"""
In-memory mock store para desenvolvimento sem VPS/Postgres.

Em produção (SEMANTICA_MOCK_MODE=false), este módulo é substituído
por uma implementação real que usa Apache AGE + PgVector em PostgreSQL.

Mantém dados em memória durante a sessão do processo.
Útil para:
  - Desenvolvimento local sem VPS
  - Testes automatizados
  - Demonstração da API sem dependências externas
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any
from collections import defaultdict
import asyncio

from ..core.models import (
    ContextNode, GraphEdge, GraphConflict, DecisionRecord,
    ProvenanceInfo, ConflictSeverity, ConflictStatus,
    RelationType, EntityType,
)


class MockStore:
    """Mock store thread-safe (asyncio.Lock) com dados sintéticos."""

    def __init__(self):
        self._lock = asyncio.Lock()
        self._nodes: Dict[str, ContextNode] = {}
        self._edges: Dict[str, GraphEdge] = {}
        self._conflicts: Dict[str, GraphConflict] = {}
        self._decisions: Dict[str, DecisionRecord] = {}
        self._tenant_node_ids: Dict[str, Set[str]] = defaultdict(set)
        self._tenant_edge_ids: Dict[str, Set[str]] = defaultdict(set)
        self._tenant_conflict_ids: Dict[str, Set[str]] = defaultdict(set)
        self._tenant_decision_ids: Dict[str, Set[str]] = defaultdict(set)
        self._node_edges: Dict[str, Set[str]] = defaultdict(set)  # nodeId → edgeIds
        self._cache_hits = 0
        self._cache_misses = 0
        self._started_at = datetime.now()
        self._seed_default_data()

    def _seed_default_data(self):
        """Popula com dados de demonstração da Pousada Maravilha."""
        tenant_id = "demo-tenant-001"

        # Nodes (regras, políticas, amenidades)
        nodes = [
            ("n_checkin_padrao", EntityType.CHECKIN, "Check-in Padrão",
             "Horário oficial de check-in é a partir das 14h00."),
            ("n_checkin_antecipado", EntityType.CHECKIN, "Check-in Antecipado",
             "Check-in antecipado disponível a partir das 11h00, mediante disponibilidade."),
            ("n_checkout", EntityType.CHECKOUT, "Check-out Padrão",
             "Horário de check-out até às 12h00."),
            ("n_pets", EntityType.POLICY, "Política de Pets",
             "Permitido pets de pequeno porte mediante taxa de higienização de R$ 50."),
            ("n_cafe_manha", EntityType.SERVICE, "Café da Manhã",
             "Café da manhã servido das 7h às 10h na área comum."),
            ("n_piscina", EntityType.AMENITY, "Piscina Aquecida",
             "Piscina aquecida disponível das 8h às 22h."),
            ("n_pix_desconto", EntityType.PAYMENT, "PIX com Desconto",
             "Pagamento via PIX tem 5% de desconto sobre o valor da diária."),
            ("n_cancelamento", EntityType.CANCEL, "Política de Cancelamento",
             "Cancelamento gratuito até 48h antes do check-in. Após, cobrança de 1 diária."),
            ("n_estacionamento", EntityType.AMENITY, "Estacionamento",
             "Estacionamento gratuito para hóspedes, 1 vaga por apartamento."),
            ("n_wifi", EntityType.AMENITY, "Wi-Fi",
             "Wi-Fi gratuito de alta velocidade em todas as áreas."),
        ]

        for node_id, ntype, name, content in nodes:
            node = ContextNode(
                id=node_id,
                tenantId=tenant_id,
                type=ntype,
                name=name,
                content=content,
                confidence=0.9,
                provenance=ProvenanceInfo(
                    source="regulamento",
                    sourceRef="manual_pousada_2024.pdf",
                    extractedBy="semantica_ner",
                    extractedAt=datetime.now() - timedelta(days=30),
                ),
                createdAt=datetime.now() - timedelta(days=30),
            )
            self._nodes[node_id] = node
            self._tenant_node_ids[tenant_id].add(node_id)

        # Edges (relações hierárquicas)
        edges = [
            # Check-in antecipado SUPERSEDES check-in padrão
            ("e1", "n_checkin_antecipado", "n_checkin_padrao", RelationType.SUPERSEDES, 10,
             "Quando solicitado check-in antecipado"),
            # Check-in antecipado REQUIRES taxa adicional
            ("e2", "n_checkin_antecipado", "n_pets", RelationType.REQUIRES, 8,
             "Check-in antecipado requer confirmação de disponibilidade"),
            # Política de pets FORBIDS animais de grande porte
            ("e3", "n_pets", "n_checkin_padrao", RelationType.OVERLAPS, 3, None),
            # Café da manhã REQUIRES estar hospedado
            ("e4", "n_cafe_manha", "n_checkin_padrao", RelationType.REQUIRES, 5, None),
            # PIX SUPERSEDES pagamento padrão
            ("e5", "n_pix_desconto", "n_cancelamento", RelationType.OVERLAPS, 2, None),
            # Piscina OVERLAPS com amenidades
            ("e6", "n_piscina", "n_wifi", RelationType.OVERLAPS, 1, None),
        ]

        for edge_id, src, tgt, rel, weight, cond in edges:
            edge = GraphEdge(
                id=edge_id,
                tenantId=tenant_id,
                sourceNodeId=src,
                targetNodeId=tgt,
                relationType=rel,
                priorityWeight=weight,
                condition=cond,
                createdAt=datetime.now() - timedelta(days=30),
            )
            self._edges[edge_id] = edge
            self._tenant_edge_ids[tenant_id].add(edge_id)
            self._node_edges[src].add(edge_id)
            self._node_edges[tgt].add(edge_id)

        # Uma decisão demo
        decision = DecisionRecord(
            id="d_demo_1",
            tenantId=tenant_id,
            category="guest_response",
            scenario="Hóspede perguntou sobre check-in antecipado às 11h",
            reasoning="Regra check-in antecipado (SUPERSEDES check-in padrão) aplicada. Nó n_checkin_antecipado justificou a resposta.",
            outcome="success",
            response="Olá! Sim, oferecemos check-in antecipado a partir das 11h00, sujeito à disponibilidade. Posso confirmar a disponibilidade para sua data?",
            confidence=0.92,
            metadata={"providerId": "glm-4.7-flash", "tier": 1, "latencyMs": 1240, "sessionId": "s_001"},
            graphNodeIds=["n_checkin_antecipado", "n_checkin_padrao"],
        )
        self._decisions[decision.id] = decision
        self._tenant_decision_ids[tenant_id].add(decision.id)

    # ─── NODES ─────────────────────────────────────────────────────────

    async def add_node(self, tenant_id: str, node_data: dict) -> ContextNode:
        async with self._lock:
            node_id = f"n_{uuid.uuid4().hex[:12]}"
            node = ContextNode(
                id=node_id,
                tenantId=tenant_id,
                **node_data,
            )
            self._nodes[node_id] = node
            self._tenant_node_ids[tenant_id].add(node_id)
            return node

    async def get_node(self, tenant_id: str, node_id: str) -> Optional[ContextNode]:
        async with self._lock:
            return self._nodes.get(node_id) if node_id in self._tenant_node_ids.get(tenant_id, set()) else None

    async def list_nodes(self, tenant_id: str, entity_type: Optional[str] = None, limit: int = 100) -> List[ContextNode]:
        async with self._lock:
            node_ids = self._tenant_node_ids.get(tenant_id, set())
            nodes = [self._nodes[nid] for nid in node_ids if nid in self._nodes]
            if entity_type:
                nodes = [n for n in nodes if n.type == entity_type]
            return nodes[:limit]

    async def update_node(self, tenant_id: str, node_id: str, updates: dict) -> Optional[ContextNode]:
        async with self._lock:
            if node_id not in self._tenant_node_ids.get(tenant_id, set()):
                return None
            node = self._nodes[node_id]
            for key, value in updates.items():
                if value is not None and hasattr(node, key):
                    setattr(node, key, value)
            node.updatedAt = datetime.now()
            return node

    async def delete_node(self, tenant_id: str, node_id: str) -> bool:
        async with self._lock:
            if node_id not in self._tenant_node_ids.get(tenant_id, set()):
                return False
            del self._nodes[node_id]
            self._tenant_node_ids[tenant_id].discard(node_id)
            # Remove edges connected to this node
            edge_ids = self._node_edges.pop(node_id, set())
            for edge_id in edge_ids:
                if edge_id in self._edges:
                    del self._edges[edge_id]
                self._tenant_edge_ids[tenant_id].discard(edge_id)
            return True

    # ─── EDGES ─────────────────────────────────────────────────────────

    async def add_edge(self, tenant_id: str, edge_data: dict) -> GraphEdge:
        async with self._lock:
            edge_id = f"e_{uuid.uuid4().hex[:12]}"
            edge = GraphEdge(
                id=edge_id,
                tenantId=tenant_id,
                **edge_data,
            )
            self._edges[edge_id] = edge
            self._tenant_edge_ids[tenant_id].add(edge_id)
            self._node_edges[edge_data["sourceNodeId"]].add(edge_id)
            self._node_edges[edge_data["targetNodeId"]].add(edge_id)
            return edge

    async def list_edges(self, tenant_id: str, limit: int = 100) -> List[GraphEdge]:
        async with self._lock:
            edge_ids = self._tenant_edge_ids.get(tenant_id, set())
            return [self._edges[eid] for eid in edge_ids if eid in self._edges][:limit]

    async def delete_edge(self, tenant_id: str, edge_id: str) -> bool:
        async with self._lock:
            if edge_id not in self._tenant_edge_ids.get(tenant_id, set()):
                return False
            edge = self._edges[edge_id]
            self._node_edges[edge.sourceNodeId].discard(edge_id)
            self._node_edges[edge.targetNodeId].discard(edge_id)
            del self._edges[edge_id]
            self._tenant_edge_ids[tenant_id].discard(edge_id)
            return True

    # ─── HYBRID SEARCH ─────────────────────────────────────────────────

    async def hybrid_search(
        self,
        tenant_id: str,
        query: str,
        hops: int = 2,
        max_nodes: int = 5,
        include_conflicts: bool = False,
    ) -> dict:
        """Busca híbrida: TF-IDF (mock) + BFS no grafo."""
        async with self._lock:
            query_lower = query.lower()
            all_nodes = [self._nodes[nid] for nid in self._tenant_node_ids.get(tenant_id, set()) if nid in self._nodes]

            # Mock TF-IDF: matching simples por palavras-chave
            keywords = ["check-in", "checkout", "café", "cafe", "pet", "piscina",
                       "pix", "cancelamento", "estacionamento", "wifi", "antecipado"]
            matched_keywords = [kw for kw in keywords if kw in query_lower]

            scored_nodes = []
            for node in all_nodes:
                content_lower = node.content.lower() + " " + node.name.lower()
                score = sum(2 if kw in content_lower else 0 for kw in matched_keywords)
                if score > 0 or len(matched_keywords) == 0:
                    scored_nodes.append((node, score))

            scored_nodes.sort(key=lambda x: -x[1])
            top_nodes = [n for n, _ in scored_nodes[:max_nodes]]
            top_node_ids = {n.id for n in top_nodes}

            # BFS no grafo a partir dos nós encontrados
            visited = set(top_node_ids)
            queue = list(top_node_ids)
            relevant_edges = []

            for _ in range(hops):
                next_queue = []
                for node_id in queue:
                    for edge_id in self._node_edges.get(node_id, set()):
                        edge = self._edges.get(edge_id)
                        if not edge:
                            continue
                        relevant_edges.append(edge)
                        neighbor = edge.targetNodeId if edge.sourceNodeId == node_id else edge.sourceNodeId
                        if neighbor not in visited:
                            visited.add(neighbor)
                            next_queue.append(neighbor)
                            # Add neighbor node if not in top_nodes
                            if neighbor in self._nodes and len(top_nodes) < max_nodes + 3:
                                top_nodes.append(self._nodes[neighbor])
                queue = next_queue
                if not queue:
                    break

            # Resolve conflicts: SUPERSEDES > FORBIDS > REQUIRES > OVERLAPS
            RELATION_PRIORITY = {
                "SUPERSEDES": 4, "FORBIDS": 3, "REQUIRES": 2, "OVERLAPS": 1,
                "ENABLES": 1, "CAUSED": 1, "INFLUENCED": 1, "PRECEDENT_FOR": 1,
            }
            relevant_edges.sort(key=lambda e: (
                -e.priorityWeight,
                -RELATION_PRIORITY.get(e.relationType, 1),
            ))

            # Build resolved context
            context_parts = ["### CONHECIMENTO HIERÁRQUICO DA POUSADA ###"]
            for node in top_nodes[:max_nodes]:
                context_parts.append(f"- [{node.type}] {node.name}: {node.content}")

            if relevant_edges:
                context_parts.append("\n### REGRAS DE PRIORIDADE E CONDIÇÕES ###")
                for edge in relevant_edges[:5]:
                    src = self._nodes.get(edge.sourceNodeId)
                    tgt = self._nodes.get(edge.targetNodeId)
                    if src and tgt:
                        cond = f" (Condição: {edge.condition})" if edge.condition else ""
                        context_parts.append(
                            f"- REGRA: \"{src.content[:80]}...\" [{edge.relationType}] "
                            f"\"{tgt.content[:80]}...\" (Prioridade: {edge.priorityWeight}){cond}"
                        )

            resolved_context = "\n".join(context_parts)

            conflicts = []
            if include_conflicts:
                conflict_ids = self._tenant_conflict_ids.get(tenant_id, set())
                conflicts = [self._conflicts[cid] for cid in conflict_ids if cid in self._conflicts][:5]

            return {
                "nodes": top_nodes[:max_nodes],
                "edges": relevant_edges[:5],
                "resolvedContext": resolved_context,
                "conflicts": conflicts,
                "searchMeta": {
                    "totalNodesScanned": len(all_nodes),
                    "totalEdgesTraversed": len(relevant_edges),
                    "cacheHit": False,
                    "latencyMs": 25,
                    "source": "semantica",
                },
            }

    # ─── CONFLICTS ──────────────────────────────────────────────────────

    async def detect_conflicts(self, tenant_id: str) -> List[GraphConflict]:
        """Detecta conflitos: nós com mesma entidade mas conteúdo contraditório."""
        async with self._lock:
            nodes = [self._nodes[nid] for nid in self._tenant_node_ids.get(tenant_id, set()) if nid in self._nodes]
            conflicts = []

            # Mock: detecta se há dois nós de CHECKIN com horários diferentes
            checkin_nodes = [n for n in nodes if n.type == EntityType.CHECKIN]
            if len(checkin_nodes) >= 2:
                # Check if there's already a conflict registered
                existing_conflict = any(
                    c.nodeIds == [checkin_nodes[0].id, checkin_nodes[1].id]
                    for c in self._conflicts.values()
                    if c.tenantId == tenant_id
                )
                if not existing_conflict:
                    conflict = GraphConflict(
                        id=f"c_{uuid.uuid4().hex[:12]}",
                        tenantId=tenant_id,
                        nodeIds=[checkin_nodes[0].id, checkin_nodes[1].id],
                        description=f"Possível conflito entre {checkin_nodes[0].name} e {checkin_nodes[1].name}",
                        severity=ConflictSeverity.MEDIUM,
                        status=ConflictStatus.DETECTED,
                        suggestedResolution={
                            "type": RelationType.SUPERSEDES,
                            "winnerNodeId": checkin_nodes[0].id,
                            "loserNodeId": checkin_nodes[1].id,
                            "reasoning": f"{checkin_nodes[0].name} é mais específico e deve prevalecer",
                        },
                    )
                    self._conflicts[conflict.id] = conflict
                    self._tenant_conflict_ids[tenant_id].add(conflict.id)
                    conflicts.append(conflict)

            return conflicts

    async def list_conflicts(self, tenant_id: str, status: Optional[str] = None) -> List[GraphConflict]:
        async with self._lock:
            conflict_ids = self._tenant_conflict_ids.get(tenant_id, set())
            conflicts = [self._conflicts[cid] for cid in conflict_ids if cid in self._conflicts]
            if status:
                conflicts = [c for c in conflicts if c.status == status]
            return conflicts

    async def resolve_conflict(
        self,
        tenant_id: str,
        conflict_id: str,
        resolution: dict,
    ) -> Optional[GraphConflict]:
        async with self._lock:
            if conflict_id not in self._tenant_conflict_ids.get(tenant_id, set()):
                return None
            conflict = self._conflicts[conflict_id]
            conflict.status = ConflictStatus.RESOLVED
            conflict.resolvedBy = "operator"
            conflict.resolvedAt = datetime.now()

            # Create edge with the resolution
            edge = GraphEdge(
                id=f"e_{uuid.uuid4().hex[:12]}",
                tenantId=tenant_id,
                sourceNodeId=resolution["winnerNodeId"],
                targetNodeId=resolution["loserNodeId"],
                relationType=resolution["type"],
                priorityWeight=10,
                condition=resolution.get("reasoning", ""),
                createdAt=datetime.now(),
            )
            self._edges[edge.id] = edge
            self._tenant_edge_ids[tenant_id].add(edge.id)

            return conflict

    # ─── DECISIONS ──────────────────────────────────────────────────────

    async def record_decision(self, decision_data: dict) -> DecisionRecord:
        async with self._lock:
            decision_id = f"d_{uuid.uuid4().hex[:12]}"
            decision = DecisionRecord(
                id=decision_id,
                **decision_data,
            )
            self._decisions[decision_id] = decision
            tenant_id = decision_data.get("tenantId", "")
            self._tenant_decision_ids[tenant_id].add(decision_id)
            return decision

    async def get_decision(self, tenant_id: str, decision_id: str) -> Optional[DecisionRecord]:
        async with self._lock:
            return self._decisions.get(decision_id) if decision_id in self._tenant_decision_ids.get(tenant_id, set()) else None

    async def list_decisions(self, tenant_id: str, limit: int = 50, offset: int = 0) -> List[DecisionRecord]:
        async with self._lock:
            decision_ids = self._tenant_decision_ids.get(tenant_id, set())
            decisions = [self._decisions[did] for did in decision_ids if did in self._decisions]
            decisions.sort(key=lambda d: d.createdAt, reverse=True)
            return decisions[offset:offset + limit]

    async def trace_decision_chain(self, tenant_id: str, decision_id: str) -> Optional[dict]:
        async with self._lock:
            decision = self._decisions.get(decision_id)
            if not decision:
                return None

            # Find parent (if any)
            parents = []
            if decision.parentDecisionId:
                parent = self._decisions.get(decision.parentDecisionId)
                if parent:
                    parents.append({
                        "decisionId": parent.id,
                        "decision": parent.model_dump(),
                        "parents": [],
                        "children": [],
                        "depth": 1,
                    })

            # Find children
            children = []
            for d in self._decisions.values():
                if d.parentDecisionId == decision_id:
                    children.append({
                        "decisionId": d.id,
                        "decision": d.model_dump(),
                        "parents": [],
                        "children": [],
                        "depth": 1,
                    })

            return {
                "decisionId": decision_id,
                "decision": decision.model_dump(),
                "parents": parents,
                "children": children,
                "depth": 0,
            }

    async def find_similar_decisions(self, tenant_id: str, query: str, max_results: int = 5) -> List[DecisionRecord]:
        async with self._lock:
            decision_ids = self._tenant_decision_ids.get(tenant_id, set())
            decisions = [self._decisions[did] for did in decision_ids if did in self._decisions]
            # Mock: returns most recent decisions (in real impl, uses vector similarity)
            decisions.sort(key=lambda d: d.createdAt, reverse=True)
            return decisions[:max_results]

    # ─── INGEST ─────────────────────────────────────────────────────────

    async def ingest(self, tenant_id: str, text: Optional[str] = None, url: Optional[str] = None, source_type: str = "manual") -> dict:
        """Pipeline completo: parse → extract → build graph.
        Em mock mode: cria nós sintéticos baseados no texto."""
        async with self._lock:
            start = datetime.now()
            nodes_created = 0
            edges_created = 0
            node_ids = []
            edge_ids = []

            if text:
                # Mock: extract simple sentences as nodes
                sentences = [s.strip() for s in text.split('.') if s.strip() and len(s.strip()) > 10]
                for sentence in sentences[:10]:  # limit to 10 nodes
                    node_id = f"n_{uuid.uuid4().hex[:12]}"
                    node = ContextNode(
                        id=node_id,
                        tenantId=tenant_id,
                        type=EntityType.RULE,
                        name=sentence[:50],
                        content=sentence,
                        confidence=0.7,
                        provenance=ProvenanceInfo(
                            source=source_type,
                            extractedBy="semantica_ner",
                            extractedAt=datetime.now(),
                        ),
                    )
                    self._nodes[node_id] = node
                    self._tenant_node_ids[tenant_id].add(node_id)
                    node_ids.append(node_id)
                    nodes_created += 1
            elif url:
                # Mock: would fetch URL and parse, for now just creates a placeholder node
                node_id = f"n_{uuid.uuid4().hex[:12]}"
                node = ContextNode(
                    id=node_id,
                    tenantId=tenant_id,
                    type=EntityType.FAQ,
                    name=f"FAQ from {url}",
                    content=f"Content fetched from URL: {url}",
                    confidence=0.6,
                    provenance=ProvenanceInfo(
                        source=source_type,
                        sourceRef=url,
                        extractedBy="semantica_web_ingestor",
                        extractedAt=datetime.now(),
                    ),
                )
                self._nodes[node_id] = node
                self._tenant_node_ids[tenant_id].add(node_id)
                node_ids.append(node_id)
                nodes_created = 1

            duration_ms = (datetime.now() - start).total_seconds() * 1000

            return {
                "tenantId": tenant_id,
                "nodesCreated": nodes_created,
                "edgesCreated": edges_created,
                "conflictsDetected": 0,
                "durationMs": int(duration_ms),
                "nodeIds": node_ids,
                "edgeIds": edge_ids,
                "conflictIds": [],
            }

    # ─── ONTOLOGY ───────────────────────────────────────────────────────

    async def validate_ontology(self, tenant_id: str) -> dict:
        """Mock: always returns valid. In prod: SHACL validation."""
        return {
            "valid": True,
            "violations": [],
        }

    # ─── REASONING ──────────────────────────────────────────────────────

    async def reason(self, tenant_id: str, query: str) -> dict:
        """Mock: returns empty inferences. In prod: Rete/Datalog engine."""
        return {
            "inferences": [],
            "query": query,
            "durationMs": 5,
        }

    # ─── LGPD ───────────────────────────────────────────────────────────

    async def forget_guest(self, guest_id: str, tenant_id: str) -> dict:
        async with self._lock:
            nodes_marked = 0
            decisions_anonymized = 0
            edges_removed = 0

            # Mark nodes with guestId in provenance as forgotten
            for node in self._nodes.values():
                if node.tenantId == tenant_id and node.provenance and node.provenance.guestId == guest_id:
                    node.forgotten = True
                    nodes_marked += 1

            # Anonymize decisions with guestId in metadata
            for decision in self._decisions.values():
                if decision.tenantId == tenant_id and decision.metadata and decision.metadata.guestId == guest_id:
                    decision.scenario = "[ANONIMIZADO - LGPD]"
                    if decision.metadata:
                        decision.metadata.guestId = None
                    decisions_anonymized += 1

            return {
                "guestId": guest_id,
                "tenantId": tenant_id,
                "nodesMarkedForgotten": nodes_marked,
                "decisionsAnonymized": decisions_anonymized,
                "edgesRemoved": edges_removed,
                "consentLogId": f"cl_{uuid.uuid4().hex[:12]}",
                "completedAt": datetime.now(),
            }

    # ─── STATS ─────────────────────────────────────────────────────────

    async def get_stats(self, tenant_id: str) -> dict:
        async with self._lock:
            node_ids = self._tenant_node_ids.get(tenant_id, set())
            edge_ids = self._tenant_edge_ids.get(tenant_id, set())
            conflict_ids = self._tenant_conflict_ids.get(tenant_id, set())
            decision_ids = self._tenant_decision_ids.get(tenant_id, set())

            nodes = [self._nodes[nid] for nid in node_ids if nid in self._nodes]
            edges = [self._edges[eid] for eid in edge_ids if eid in self._edges]
            conflicts = [self._conflicts[cid] for cid in conflict_ids if cid in self._conflicts]
            decisions = [self._decisions[did] for did in decision_ids if did in self._decisions]

            # Calculate brain age (days since first node created)
            if nodes:
                oldest = min(n.createdAt for n in nodes)
                brain_age = (datetime.now() - oldest).days
            else:
                brain_age = 0

            # Count by type/relation
            nodes_by_type = defaultdict(int)
            for n in nodes:
                nodes_by_type[n.type] += 1

            edges_by_relation = defaultdict(int)
            for e in edges:
                edges_by_relation[e.relationType] += 1

            return {
                "tenantId": tenant_id,
                "totalNodes": len(nodes),
                "totalEdges": len(edges),
                "nodesByType": dict(nodes_by_type),
                "edgesByRelation": dict(edges_by_relation),
                "conflicts": {
                    "detected": len(conflicts),
                    "resolved": len([c for c in conflicts if c.status == ConflictStatus.RESOLVED]),
                    "pending": len([c for c in conflicts if c.status == ConflictStatus.DETECTED]),
                },
                "decisions": {
                    "total": len(decisions),
                    "last24h": len([d for d in decisions if (datetime.now() - d.createdAt).total_seconds() < 86400]),
                },
                "brainAge": brain_age,
            }

    async def get_health(self) -> dict:
        async with self._lock:
            uptime = datetime.now() - self._started_at
            total = self._cache_hits + self._cache_misses
            hit_rate = (self._cache_hits / total * 100) if total > 0 else 0

            return {
                "status": "ok",
                "version": "1.0.0",
                "uptime": f"{int(uptime.total_seconds() // 3600)}h {int((uptime.total_seconds() % 3600) // 60)}m",
                "postgres": "connected" if not settings.mock_mode else "mock",
                "age": "connected" if not settings.mock_mode else "mock",
                "pgvector": "connected" if not settings.mock_mode else "mock",
                "totalTenants": len(self._tenant_node_ids),
                "totalNodes": len(self._nodes),
                "totalEdges": len(self._edges),
                "totalDecisions": len(self._decisions),
                "totalConflicts": len(self._conflicts),
                "cacheHitRate": round(hit_rate, 2),
            }


# Singleton
_store: Optional[MockStore] = None


def get_store() -> MockStore:
    global _store
    if _store is None:
        _store = MockStore()
    return _store


from ..core.config import settings
