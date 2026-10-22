"""Minimum-cost assignment (Hungarian algorithm), small and dependency-free.

Used to give each identity of a group a different studied image while preferring the
images that identity has been shown least often (see app/assignment.py).
"""


def min_cost_assignment(cost):
    """Rows → distinct columns minimizing total cost (Hungarian algorithm, rows <= columns)."""
    n, m = len(cost), len(cost[0])
    INF = float("inf")
    u, v = [0.0] * (n + 1), [0.0] * (m + 1)
    owner, way = [0] * (m + 1), [0] * (m + 1)  # owner[j]: row (1-based) holding column j
    for i in range(1, n + 1):
        owner[0], j0 = i, 0
        minv, used = [INF] * (m + 1), [False] * (m + 1)
        while owner[j0]:
            used[j0] = True
            i0, delta, j1 = owner[j0], INF, 0
            for j in range(1, m + 1):
                if not used[j]:
                    cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j], way[j] = cur, j0
                    if minv[j] < delta:
                        delta, j1 = minv[j], j
            for j in range(m + 1):
                if used[j]:
                    u[owner[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
        while j0:
            j1 = way[j0]
            owner[j0] = owner[j1]
            j0 = j1
    result = [0] * n
    for j in range(1, m + 1):
        if owner[j]:
            result[owner[j] - 1] = j - 1
    return result
