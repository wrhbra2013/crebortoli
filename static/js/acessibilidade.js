//Funções de Acessibilidade.
function contrast(){
    document.body.style.backgroundColor="black"; 
    document.body.style.color="white";
          

};

let tamanho = 16;
function font_mais(){
    tamanho++;
    document.body.style.fontSize=tamanho+"px"; 
};

function font_menos(){
    tamanho--;
    document.body.style.fontSize=tamanho+"px";
}

