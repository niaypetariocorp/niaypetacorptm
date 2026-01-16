import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Lista de áreas que precisam ser corrigidas
areas = [
    ("// ÁREA POKÉMON NPC (MESTRE)", 5152),
    ("// ÁREA BATALHA", None),
    ("// ÁREA ENCICLOPÉDIA M", None),
    ("// ÁREA VISÃO DO MESTRE", None),
    ("// ÁREA DO TREINADOR", None),
    ("// ÁREA DO PC", None),
    ("// ÁREA DA POKÉDEX", None),
    ("// ÁREA DA MOCHILA", None),
    ("// ÁREA DA POKÉLOJA", None),
    ("// ÁREA CARACTERÍSTICAS & TALENTOS", None),
    ("// ÁREA ENCICLOPÉDIA", None)
]

lines = content.split('\n')

# Encontrar e corrigir cada área
for i, line in enumerate(lines):
    # Procurar por padrões de início de área que ainda não têm AccountDataModal
    if 'ÁREA POKÉMON NPC (MESTRE)' in line:
        # Procurar o return logo depois
        for j in range(i, min(i+5, len(lines))):
            if 'return (' in lines[j] and '<AccountDataModal />' not in lines[j+1]:
                # Inserir AccountDataModal
                indent = len(lines[j]) - len(lines[j].lstrip())
                lines.insert(j+1, ' ' * (indent + 2) + '<>')
                lines.insert(j+2, ' ' * (indent + 4) + '<AccountDataModal />')
                break
        # Procurar o fechamento
        for j in range(i, len(lines)):
            if lines[j].strip() == ')' and j > i + 10:
                if lines[j+1].strip() == '}' and '</>' not in lines[j-1]:
                    lines.insert(j, ' ' * 6 + '</>')
                    break

# Salvar
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Fixed!")
