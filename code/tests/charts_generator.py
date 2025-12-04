import matplotlib.pyplot as plt

PATH = 'tese/USPSC-img/'

def gerar_grafico(temperaturas, metricas, nome_arquivo):
    # plt.figure(figsize=(10, 6))
    
    # Plota cada linha
    for nome, valores in metricas.items():
        plt.plot(temperaturas, valores, marker='o', label=nome)

    # Configurações visuais
    plt.xlabel('Temperatura')
    plt.ylabel('Porcentagem (%)')
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.xticks(temperaturas)
    
    # Ajuste de escala (opcional, pode remover se os dados variarem muito)
    # plt.ylim(80, 105) 

    # Salva e fecha para liberar memória
    plt.savefig(nome_arquivo, bbox_inches='tight')
    plt.close()
    print(f"Gráfico salvo: {nome_arquivo}")


x_scout = [0.0, 0.1, 0.5, 1.0]
y_scout = {
    'Acurácia':     [92.5, 93.8, 95.0, 91.3],
    'Precisão':     [94.7, 92.7, 95.0, 94.6],
    'Revocação':    [90.0, 95.0, 95.0, 87.5],
    'Consistência': [90.0, 97.5, 100.0, 97.5]
}
gerar_grafico(x_scout, y_scout, PATH + 'grafico_metricas_scout.png')

x_maverick = [0.0, 0.1, 0.5, 1.0] # Ajuste as temperaturas se necessário
y_maverick = {
    'Acurácia':     [87.3, 85.0, 86.3, 83.8], # Substitua pelos valores da imagem
    'Precisão':     [94.1, 93.8, 91.4, 86.5],
    'Revocação':    [80.0, 75.0, 80.0, 80.0],
    'Consistência': [97.5, 100 , 97.5, 97.5]
}
gerar_grafico(x_maverick, y_maverick, PATH + 'grafico_metricas_maverick.png')

x_gemini = [0.0, 0.1, 0.5]
y_gemini = {
    'Acurácia':     [90.0, 88.8, 88.8], 
    'Precisão':     [83.3, 81.6, 81.6],
    'Revocação':    [100 , 100 , 100 ],
    'Consistência': [100 , 97.5, 97.5]
}
gerar_grafico(x_gemini, y_gemini, PATH + 'grafico_metricas_gemini.png')