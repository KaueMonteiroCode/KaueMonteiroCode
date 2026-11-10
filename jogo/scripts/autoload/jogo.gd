extends Node
## Estado global: ouro, fazenda, upgrades, controles e save.

signal pedir_cena(nome: String)

const CAMINHO_SAVE := "user://save.json"
const NUM_CANTEIROS := 8
const DIAS_PARA_CRESCER := 3
const PRECO_SEMENTE := 5
const PRECO_COLHEITA := 15
const NIVEL_ARMA_MAX := 5
const VIDA_MAX_LIMITE := 10
const CLASSES := {
	"cavaleiro": {
		"nome": "Cavaleiro", "vida": 2,
		"desc": "Muita vida. Tiro curto em leque. Habilidade: escudo.",
	},
	"mago": {
		"nome": "Mago", "vida": 0,
		"desc": "Magia lenta que atravessa inimigos. Habilidade: explosão.",
	},
	"ranger": {
		"nome": "Ranger", "vida": -1,
		"desc": "Flechas rápidas. Habilidade: rajada.",
	},
}
const NOMES_MISSAO := {
	"colher": "Colher %d plantas",
	"slime": "Derrotar %d slimes",
	"arqueiro": "Derrotar %d arqueiros",
	"chefe": "Derrotar o chefe",
}

var ouro := 0
var sementes := 0
var colheitas := 0
var dia := 1
var nivel_arma := 1
var vida_max := 6
var canteiros: Array = []
var primeira_vez := true
var classe := ""
var missao: Dictionary = {}
var manha_pendente := false


func _ready() -> void:
	_criar_controles()
	carregar()


func ir_para(cena: String) -> void:
	pedir_cena.emit(cena)


func custo_arma() -> int:
	return 30 * nivel_arma


func custo_vida() -> int:
	return 40 * (vida_max - 5)


func passar_dia() -> void:
	dia += 1
	for c in canteiros:
		if c["plantado"] and c["regado"]:
			c["dias"] += 1
		c["regado"] = false
	manha_pendente = true
	salvar()


func vida_total() -> int:
	var info: Dictionary = CLASSES.get(classe, {})
	return vida_max + int(info.get("vida", 0))


# --- Missões ---------------------------------------------------------

func gerar_missao(dado: int) -> void:
	var tipo: String = ["colher", "slime", "arqueiro", "chefe"].pick_random()
	var alvo := 1
	var base := 60
	match tipo:
		"colher":
			alvo = randi_range(3, 5)
			base = alvo * 10
		"slime":
			alvo = randi_range(8, 14)
			base = alvo * 3
		"arqueiro":
			alvo = randi_range(4, 7)
			base = alvo * 6
	var mult := 1.0
	if dado == 20:
		mult = 2.0
	elif dado >= 15:
		mult = 1.5
	elif dado <= 3:
		mult = 0.75
	missao = {
		"tipo": tipo, "alvo": alvo, "progresso": 0,
		"recompensa": int(base * mult), "concluida": false,
	}
	salvar()


func texto_missao() -> String:
	if missao.is_empty():
		return ""
	var texto: String = NOMES_MISSAO.get(missao["tipo"], "?")
	if "%d" in texto:
		texto = texto % int(missao["alvo"])
	return "%s (%d/%d)" % [texto, int(missao["progresso"]), int(missao["alvo"])]


## Avisa que algo aconteceu ("colher", "slime", "arqueiro", "chefe").
func registrar(evento: String) -> void:
	if missao.is_empty() or missao.get("concluida", false):
		return
	if missao["tipo"] != evento:
		return
	missao["progresso"] = mini(int(missao["progresso"]) + 1, int(missao["alvo"]))
	if int(missao["progresso"]) >= int(missao["alvo"]):
		missao["concluida"] = true
		Narrador.falar("Missão cumprida! Volte ao quadro da vila para pegar a recompensa.")


func canteiro_pronto(i: int) -> bool:
	var c: Dictionary = canteiros[i]
	return c["plantado"] and c["dias"] >= DIAS_PARA_CRESCER


# --- Save -------------------------------------------------------------

func salvar() -> void:
	var dados := {
		"ouro": ouro,
		"sementes": sementes,
		"colheitas": colheitas,
		"dia": dia,
		"nivel_arma": nivel_arma,
		"vida_max": vida_max,
		"canteiros": canteiros,
		"primeira_vez": primeira_vez,
		"classe": classe,
		"missao": missao,
	}
	var arquivo := FileAccess.open(CAMINHO_SAVE, FileAccess.WRITE)
	if arquivo:
		arquivo.store_string(JSON.stringify(dados))


func carregar() -> void:
	_novo_jogo()
	if not FileAccess.file_exists(CAMINHO_SAVE):
		return
	var arquivo := FileAccess.open(CAMINHO_SAVE, FileAccess.READ)
	if arquivo == null:
		return
	var dados = JSON.parse_string(arquivo.get_as_text())
	if not (dados is Dictionary):
		return
	ouro = int(dados.get("ouro", ouro))
	sementes = int(dados.get("sementes", sementes))
	colheitas = int(dados.get("colheitas", colheitas))
	dia = int(dados.get("dia", dia))
	nivel_arma = int(dados.get("nivel_arma", nivel_arma))
	vida_max = int(dados.get("vida_max", vida_max))
	primeira_vez = bool(dados.get("primeira_vez", false))
	classe = str(dados.get("classe", ""))
	if not CLASSES.has(classe):
		classe = ""
	var m = dados.get("missao", {})
	if m is Dictionary:
		missao = m
	var lista = dados.get("canteiros", [])
	if lista is Array and lista.size() == NUM_CANTEIROS:
		for i in NUM_CANTEIROS:
			var c = lista[i]
			if c is Dictionary:
				canteiros[i] = {
					"plantado": bool(c.get("plantado", false)),
					"regado": bool(c.get("regado", false)),
					"dias": int(c.get("dias", 0)),
				}


func _novo_jogo() -> void:
	ouro = 20
	sementes = 3
	colheitas = 0
	dia = 1
	nivel_arma = 1
	vida_max = 6
	primeira_vez = true
	classe = ""
	missao = {}
	canteiros.clear()
	for i in NUM_CANTEIROS:
		canteiros.append({"plantado": false, "regado": false, "dias": 0})


# --- Controles (teclado, controle e toque usam as mesmas acoes) -------

func _criar_controles() -> void:
	_acao("mover_esquerda", [KEY_A, KEY_LEFT])
	_acao("mover_direita", [KEY_D, KEY_RIGHT])
	_acao("mover_cima", [KEY_W, KEY_UP])
	_acao("mover_baixo", [KEY_S, KEY_DOWN])
	_acao("atacar", [KEY_J, KEY_SPACE])
	_acao("interagir", [KEY_E, KEY_K])
	_acao("dash", [KEY_SHIFT, KEY_L])
	_acao("habilidade", [KEY_Q, KEY_I])
	_eixo("mover_esquerda", JOY_AXIS_LEFT_X, -1.0)
	_eixo("mover_direita", JOY_AXIS_LEFT_X, 1.0)
	_eixo("mover_cima", JOY_AXIS_LEFT_Y, -1.0)
	_eixo("mover_baixo", JOY_AXIS_LEFT_Y, 1.0)
	_botao_controle("atacar", JOY_BUTTON_X)
	_botao_controle("interagir", JOY_BUTTON_A)
	_botao_controle("dash", JOY_BUTTON_B)
	_botao_controle("habilidade", JOY_BUTTON_Y)


func _acao(nome: String, teclas: Array) -> void:
	if not InputMap.has_action(nome):
		InputMap.add_action(nome, 0.2)
	for tecla in teclas:
		var ev := InputEventKey.new()
		ev.physical_keycode = tecla
		InputMap.action_add_event(nome, ev)


func _eixo(nome: String, eixo: JoyAxis, valor: float) -> void:
	var ev := InputEventJoypadMotion.new()
	ev.axis = eixo
	ev.axis_value = valor
	InputMap.action_add_event(nome, ev)


func _botao_controle(nome: String, botao: JoyButton) -> void:
	var ev := InputEventJoypadButton.new()
	ev.button_index = botao
	InputMap.action_add_event(nome, ev)
