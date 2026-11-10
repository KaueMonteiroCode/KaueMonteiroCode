extends Node
## Teste automático: joga sozinho passando pela vila, loja, fazenda e masmorra.
## Rodar: godot --headless --path jogo res://testes/teste_fluxo.tscn

var _main: Node
var _falhas := 0


func _ready() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Jogo.CAMINHO_SAVE))
	Jogo.carregar()
	_main = load("res://cenas/main.tscn").instantiate()
	add_child(_main)
	_rodar()


func _rodar() -> void:
	await _quadros(5)
	_checar(Jogo.classe == "", "começa sem classe")
	var botoes := _main.find_children("*", "Button", true, false)
	_checar(botoes.size() == 3, "tela de classes tem 3 botões")
	(botoes[1] as Button).pressed.emit()  # mago
	await _quadros(5)
	_checar(Jogo.classe == "mago", "escolheu mago")

	await _testar_vila()
	for classe in ["mago", "cavaleiro", "ranger"]:
		Jogo.classe = classe
		await _testar_masmorra_vitoria()
	await _testar_morte()

	print("=== TESTE TERMINOU: %d falha(s) ===" % _falhas)
	get_tree().quit(1 if _falhas > 0 else 0)


func _testar_vila() -> void:
	var vila := _cena_atual()
	_checar(vila != null and vila.has_method("_dormir"), "vila carregou")
	# fazenda: plantar, regar, dormir 3x, colher, vender
	vila.call("_usar_canteiro", 0)
	_checar(Jogo.canteiros[0]["plantado"], "plantou")
	for i in 3:
		vila.call("_usar_canteiro", 0)
		vila.call("_dormir")
	# Garante que está pronto mesmo com corvos/chuva aleatórios.
	Jogo.canteiros[0] = {"plantado": true, "regado": false, "dias": Jogo.DIAS_PARA_CRESCER}
	vila.call("_usar_canteiro", 0)
	_checar(Jogo.colheitas == 1, "colheu 1")
	vila.call("_vender")
	_checar(Jogo.colheitas == 0, "vendeu")
	# loja
	Jogo.ouro = 500
	vila.call("_abrir_loja")
	await _quadros(2)
	vila.call("_comprar_semente", 5)
	vila.call("_melhorar_arma")
	vila.call("_melhorar_vida")
	_checar(Jogo.nivel_arma == 2 and Jogo.vida_max == 7, "upgrades da loja")
	vila.call("_fechar_loja")
	# missões
	vila.call("_usar_quadro")
	_checar(not Jogo.missao.is_empty(), "missão criada")
	Jogo.missao["progresso"] = int(Jogo.missao["alvo"]) - 1
	Jogo.registrar(Jogo.missao["tipo"])
	_checar(Jogo.missao.get("concluida", false), "missão concluída")
	var ouro_antes := Jogo.ouro
	vila.call("_usar_quadro")
	_checar(Jogo.ouro > ouro_antes and Jogo.missao.is_empty(), "recompensa da missão")
	# andar e interagir via Input
	Input.action_press("mover_direita")
	await _quadros(20)
	Input.action_release("mover_direita")
	Input.action_press("interagir")
	await _quadros(2)
	Input.action_release("interagir")
	await _quadros(2)


func _testar_masmorra_vitoria() -> void:
	Jogo.nivel_arma = 3
	Jogo.ir_para("masmorra")
	await _quadros(5)
	var m := _cena_atual()
	_checar(m != null and m.has_method("_proxima_sala"), "masmorra carregou (%s)" % Jogo.classe)
	Input.action_press("atacar")
	Input.action_press("habilidade")
	await _quadros(3)
	Input.action_release("habilidade")
	for s in 5:
		await _quadros(60)  # inimigos surgem e atiram
		var sala_antes: int = m.get("sala")
		# mata todos
		for ini in get_tree().get_nodes_in_group("inimigos"):
			ini.call("receber_dano", 9999)
		await _quadros(5)
		var porta := _porta(m)
		_checar(porta != null, "porta apareceu na sala %d" % sala_antes)
		if porta == null:
			break
		var j := get_tree().get_first_node_in_group("jogador") as Node2D
		j.global_position = porta.global_position
		await _quadros(5)
		if sala_antes < 5:
			_checar(m.get("sala") == sala_antes + 1, "foi para a sala %d" % (sala_antes + 1))
	Input.action_release("atacar")
	await _quadros(5)
	_checar(_cena_atual() != null and _cena_atual().has_method("_dormir"),
		"voltou para a vila após vencer (%s)" % Jogo.classe)


func _testar_morte() -> void:
	var dia_antes := Jogo.dia
	Jogo.ir_para("masmorra")
	await _quadros(5)
	var j := get_tree().get_first_node_in_group("jogador")
	for i in 20:
		j.set("_invencivel", 0.0)
		j.call("receber_dano", 1)
	await _quadros(200)  # espera o timer de 2,5 s
	_checar(_cena_atual() != null and _cena_atual().has_method("_dormir"), "morreu e voltou à vila")
	_checar(Jogo.dia == dia_antes + 1, "dia passou após morrer")


func _porta(m: Node) -> Area2D:
	for a in m.find_children("*", "Area2D", true, false):
		if a.get_script() == null:
			return a
	return null


func _cena_atual() -> Node:
	return _main.get("_atual")


func _quadros(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _checar(ok: bool, texto: String) -> void:
	print(("  ok    " if ok else "  FALHA ") + texto)
	if not ok:
		_falhas += 1
